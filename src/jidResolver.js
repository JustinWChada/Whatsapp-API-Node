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
 * Resolve a JID to its phone number and name (sync, no network calls)
 */
function resolveJidToPhone(jid) {
  const mappings = loadJidMappings();

  if (mappings.jidMappings[jid]) {
    return mappings.jidMappings[jid];
  }

  const plainId = extractPhoneFromJid(jid);
  for (const [mappedJid, mapping] of Object.entries(mappings.jidMappings)) {
    if (extractPhoneFromJid(mappedJid) === plainId) {
      return mapping;
    }
  }

  return null;
}

/**
 * Update or add a JID mapping.
 * Only overwrites the name if the new name is a real name (not a fallback placeholder).
 */
function updateJidMapping(jid, phone, name = null, type = 'personal') {
  const mappings = loadJidMappings();
  const normalizedJid = normalizeJid(jid);

  if (!mappings.jidMappings[normalizedJid]) {
    mappings.jidMappings[normalizedJid] = {};
  }

  mappings.jidMappings[normalizedJid].phone = phone;
  mappings.jidMappings[normalizedJid].type = type;
  mappings.jidMappings[normalizedJid].lastUpdated = new Date().toISOString();

  // Only set a real phone_number for @s.whatsapp.net JIDs.
  // @lid JIDs are internal WhatsApp Linked Device IDs — NOT real phone numbers.
  // phone_number for @lid contacts gets populated via contacts.upsert in bot.js
  // when WhatsApp syncs your contact list and reveals the real number.
  if (normalizedJid.includes('@s.whatsapp.net')) {
    mappings.jidMappings[normalizedJid].phone_number = '+' + phone;
  } else if (!mappings.jidMappings[normalizedJid].phone_number) {
    // Leave existing phone_number if already set, otherwise mark as pending
    mappings.jidMappings[normalizedJid].phone_number = null;
  }

  const isRealName = name &&
    !name.startsWith('No Username') &&
    !name.startsWith('Member ');

  const currentName = mappings.jidMappings[normalizedJid].name || '';
  const currentIsPlaceholder = !currentName ||
    currentName.startsWith('No Username') ||
    currentName.startsWith('Member ');

  if (isRealName || currentIsPlaceholder) {
    mappings.jidMappings[normalizedJid].name = name || currentName;
  }

  saveJidMappings(mappings);
  return mappings.jidMappings[normalizedJid];
}

/**
 * Normalize a JID by adding proper suffix if missing
 */
function normalizeJid(jid) {
  if (jid.includes('@')) return jid;
  if (jid.length > 15) return `${jid}@lid`;
  return `${jid}@s.whatsapp.net`;
}

/**
 * Extract plain phone number / ID from a full JID
 */
function extractPhoneFromJid(jid) {
  return jid
    .replace(/@s\.whatsapp\.net$/, '')
    .replace(/@g\.us$/, '')
    .replace(/@lid$/, '')
    .replace(/@c\.us$/, '');
}

/**
 * Resolve a JID to phone + name using a priority chain:
 *
 *  1. Saved contact name  — from contactsCache (Map populated via contacts.upsert in bot.js)
 *                           This is the name YOU saved in your phone for this contact.
 *  2. Push name           — the WhatsApp display name the contact set on their own profile
 *                           (comes from msg.pushName on every incoming message)
 *  3. Mapped name         — whatever real name is already stored in jidMappings.json
 *  4. Fallback            — "No Username - [id]"
 *
 * Any resolved real name is persisted back to jidMappings.json so it survives restarts.
 *
 * @param {string} jid            Full JID of the sender
 * @param {Map}    contactsCache  Map<jid, name> built from contacts.upsert events in bot.js
 * @param {string} pushName       msg.pushName from the Baileys message (may be null/undefined)
 *
 * @returns {{ phone, name, type, nameSource }} or null if JID is completely unknown
 */
function resolveJidToPhoneWithName(jid, contactsCache = new Map(), pushName = null) {
  const mappings = loadJidMappings();

  // Find existing mapping — exact match first, then plain-id match
  let mapping = mappings.jidMappings[jid];
  if (!mapping) {
    const plainId = extractPhoneFromJid(jid);
    for (const [mappedJid, mappedData] of Object.entries(mappings.jidMappings)) {
      if (extractPhoneFromJid(mappedJid) === plainId) {
        mapping = mappedData;
        break;
      }
    }
  }

  if (!mapping) return null;

  const result = { ...mapping };

  const isReal = (n) => n && !n.startsWith('No Username') && !n.startsWith('Member ');

  // --- Priority 1: saved contact name from your phone ---
  const savedName =
    contactsCache.get(jid) ||
    contactsCache.get(extractPhoneFromJid(jid));

  if (isReal(savedName)) {
    result.name = savedName;
    result.nameSource = 'saved';
    updateJidMapping(jid, result.phone, savedName, result.type);
    return result;
  }

  // --- Priority 2: WhatsApp push name (the contact's own WA profile name) ---
  if (isReal(pushName)) {
    result.name = pushName;
    result.nameSource = 'push';
    updateJidMapping(jid, result.phone, pushName, result.type);
    return result;
  }

  // --- Priority 3: name already stored in jidMappings.json ---
  if (isReal(result.name)) {
    result.nameSource = 'mapped';
    return result;
  }

  // --- Priority 4: fallback ---
  result.name = `No Username - ${result.phone}`;
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
};