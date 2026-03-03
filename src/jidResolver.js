const fs = require('fs');
const path = require('path');

const jidMappingsPath = path.join(__dirname, '..', 'data', 'jidMappings.json');

/**
 * Load JID mappings from disk
 */
function loadJidMappings() {
  if (!fs.existsSync(jidMappingsPath)) {
    return { jidMappings: {} };
  }
  const raw = fs.readFileSync(jidMappingsPath, 'utf8');
  if (!raw.trim()) return { jidMappings: {} };
  return JSON.parse(raw);
}

/**
 * Save JID mappings to disk
 */
function saveJidMappings(mappings) {
  fs.writeFileSync(jidMappingsPath, JSON.stringify(mappings, null, 2));
}

/**
 * Resolve a JID to its phone number and name
 * Handles both personal (@s.whatsapp.net) and business (@lid) accounts
 * 
 * Returns: { phone: "263780736090", name: "John", type: "personal|business" }
 * or null if not found
 */
function resolveJidToPhone(jid) {
  const mappings = loadJidMappings();
  
  // Try exact match first
  if (mappings.jidMappings[jid]) {
    return mappings.jidMappings[jid];
  }
  
  // Try without suffix
  const plainId = jid
    .replace(/@s\.whatsapp\.net$/, '')
    .replace(/@g\.us$/, '')
    .replace(/@lid$/, '')
    .replace(/@c\.us$/, '');
  
  // Search for matching entry
  for (const [mappedJid, mapping] of Object.entries(mappings.jidMappings)) {
    const mappedPlain = mappedJid
      .replace(/@s\.whatsapp\.net$/, '')
      .replace(/@g\.us$/, '')
      .replace(/@lid$/, '')
      .replace(/@c\.us$/, '');
    
    if (mappedPlain === plainId) {
      return mapping;
    }
  }
  
  return null;
}

/**
 * Update or add a JID mapping
 * Called when a message arrives from an unknown JID
 */
function updateJidMapping(jid, phone, name = null, type = 'personal') {
  const mappings = loadJidMappings();
  
  // Normalize JID (ensure suffix)
  const normalizedJid = normalizeJid(jid);
  
  if (!mappings.jidMappings[normalizedJid]) {
    mappings.jidMappings[normalizedJid] = {};
  }
  
  // Update fields
  mappings.jidMappings[normalizedJid].phone = phone;
  mappings.jidMappings[normalizedJid].type = type;
  mappings.jidMappings[normalizedJid].lastUpdated = new Date().toISOString();
  
  // Only update name if provided and different
  if (name && (!mappings.jidMappings[normalizedJid].name || 
               mappings.jidMappings[normalizedJid].name.startsWith('No Username'))) {
    mappings.jidMappings[normalizedJid].name = name;
  }
  
  saveJidMappings(mappings);
  return mappings.jidMappings[normalizedJid];
}

/**
 * Normalize a JID by adding proper suffix if missing
 */
function normalizeJid(jid) {
  // Already has suffix
  if (jid.includes('@')) {
    return jid;
  }
  
  // No suffix - determine type based on format
  // Business IDs are typically longer numeric strings
  if (jid.length > 15) {
    return `${jid}@lid`;
  }
  
  return `${jid}@s.whatsapp.net`;
}

/**
 * Extract plain phone number from JID
 */
function extractPhoneFromJid(jid) {
  return jid
    .replace(/@s\.whatsapp\.net$/, '')
    .replace(/@g\.us$/, '')
    .replace(/@lid$/, '')
    .replace(/@c\.us$/, '');
}

/**
 * Try to fetch contact name from Baileys (device contact list)
 * Uses contact status and availability to get the contact display name
 */
async function tryFetchContactName(sock, jid) {
  try {
    // Extract phone number from JID
    const plainId = jid
      .replace(/@s\.whatsapp\.net$/, '')
      .replace(/@g\.us$/, '')
      .replace(/@lid$/, '')
      .replace(/@c\.us$/, '');

    // Try to get contact from Baileys
    // This checks if there's a saved contact with this number
    const contacts = await sock.contacts.get(plainId);
    if (contacts && contacts.name) {
      return contacts.name;
    }

    // Alternative: Check if contact has a status/notification name
    const status = await sock.fetchStatus(jid).catch(() => null);
    if (status?.status) {
      // Status available means contact is somewhat known
      return null; // Return null to keep fallback
    }

    return null;
  } catch (err) {
    // Contact fetch failed - this is normal for unknown contacts
    return null;
  }
}

/**
 * Resolve a JID to its phone number and name
 * Handles both personal (@s.whatsapp.net) and business (@lid) accounts
 * Includes priority-based name resolution:
 * 1. Saved contact name (from device contact list)
 * 2. jidMappings.json stored name
 * 3. Fallback: "No Username - [ID]"
 * 
 * Returns: { phone: "263780736090", name: "John", type: "personal", nameSource: "saved|mapped|fallback" }
 * or null if not found
 */
async function resolveJidToPhoneWithName(sock, jid) {
  const mappings = loadJidMappings();
  
  // Try exact match first
  let mapping = mappings.jidMappings[jid];
  
  // Try without suffix if exact match failed
  if (!mapping) {
    const plainId = jid
      .replace(/@s\.whatsapp\.net$/, '')
      .replace(/@g\.us$/, '')
      .replace(/@lid$/, '')
      .replace(/@c\.us$/, '');
    
    // Search for matching entry
    for (const [mappedJid, mappedData] of Object.entries(mappings.jidMappings)) {
      const mappedPlain = mappedJid
        .replace(/@s\.whatsapp\.net$/, '')
        .replace(/@g\.us$/, '')
        .replace(/@lid$/, '')
        .replace(/@c\.us$/, '');
      
      if (mappedPlain === plainId) {
        mapping = mappedData;
        break;
      }
    }
  }

  // Build result with name resolution priority
  const result = mapping ? { ...mapping } : null;

  if (!result) {
    return null;
  }

  // Priority 1: Try to fetch saved contact name from device
  if (sock) {
    try {
      const savedContactName = await tryFetchContactName(sock, jid);
      if (savedContactName && !savedContactName.startsWith('No Username')) {
        result.name = savedContactName;
        result.nameSource = 'saved';
        // Update mapping with new contact name
        updateJidMapping(jid, result.phone, savedContactName, result.type);
        return result;
      }
    } catch (err) {
      // Contact fetch failed, continue to fallback
    }
  }

  // Priority 2: Use mapped name from jidMappings.json
  if (result.name && !result.name.startsWith('No Username')) {
    result.nameSource = 'mapped';
    return result;
  }

  // Priority 3: Fallback to default label
  result.name = result.name || `No Username - ${result.phone}`;
  result.nameSource = 'fallback';

  return result;
}

module.exports = {
  loadJidMappings,
  saveJidMappings,
  resolveJidToPhone,
  resolveJidToPhoneWithName,
  updateJidMapping,
  normalizeJid,
  extractPhoneFromJid,
  tryFetchContactName,
};
