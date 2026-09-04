// Reads embedded ID3 tags from stock-library WAV/MP3 files, including the
// "US SUB PUB: Name (PRO)" convention used by libraries like Extreme Music.
// Tested directly against real Extreme Music WAV and MP3 samples.

function decodeID3Text(bytes) {
  if (bytes.length === 0) return '';
  const encByte = bytes[0];
  const body = bytes.subarray(1);
  let text;
  if (encByte === 1 || encByte === 2) {
    let start = 0;
    let little = true;
    if (body.length >= 2 && body[0] === 0xff && body[1] === 0xfe) { little = true; start = 2; }
    else if (body.length >= 2 && body[0] === 0xfe && body[1] === 0xff) { little = false; start = 2; }
    const codeUnits = [];
    for (let i = start; i + 1 < body.length; i += 2) {
      const a = body[i], b = body[i + 1];
      codeUnits.push(little ? (b << 8 | a) : (a << 8 | b));
    }
    text = String.fromCharCode(...codeUnits);
  } else {
    text = new TextDecoder('utf-8').decode(body);
  }
  return text.replace(/\u0000+$/, '').trim();
}

function parseID3Frames(bytes, view, tagStart, tagSize, majorVersion) {
  const frames = {};
  let pos = tagStart + 10;
  const end = tagStart + 10 + tagSize;
  while (pos + 10 <= end) {
    const frameId = String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
    if (!/^[A-Z0-9]{4}$/.test(frameId)) break;
    let frameSize;
    if (majorVersion >= 4) {
      frameSize = ((bytes[pos + 4] & 0x7f) << 21) | ((bytes[pos + 5] & 0x7f) << 14) | ((bytes[pos + 6] & 0x7f) << 7) | (bytes[pos + 7] & 0x7f);
    } else {
      frameSize = view.getUint32(pos + 4, false);
    }
    const dataStart = pos + 10;
    if (frameSize <= 0 || dataStart + frameSize > bytes.length) break;
    if (frameId[0] === 'T' && frameId !== 'TXXX') {
      frames[frameId] = decodeID3Text(bytes.subarray(dataStart, dataStart + frameSize));
    }
    pos = dataStart + frameSize;
  }
  return frames;
}

function findID3Tag(bytes, view) {
  const asciiAt = (offset) => String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2]);
  if (bytes.length > 10 && asciiAt(0) === 'ID3') {
    const major = bytes[3];
    const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
    return { tagStart: 0, tagSize: size, majorVersion: major };
  }
  if (bytes.length > 12 && asciiAt(0) === 'RIF' && bytes[3] === 0x46) {
    let pos = 12;
    while (pos + 8 <= bytes.length) {
      const chunkId = String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]).toLowerCase();
      const chunkSize = view.getUint32(pos + 4, true);
      const dataStart = pos + 8;
      if (chunkId === 'id3 ' || chunkId === 'id3') {
        if (dataStart + 10 <= bytes.length && asciiAt(dataStart) === 'ID3') {
          const major = bytes[dataStart + 3];
          const size = ((bytes[dataStart + 6] & 0x7f) << 21) | ((bytes[dataStart + 7] & 0x7f) << 14) | ((bytes[dataStart + 8] & 0x7f) << 7) | (bytes[dataStart + 9] & 0x7f);
          return { tagStart: dataStart, tagSize: size, majorVersion: major };
        }
      }
      pos = dataStart + chunkSize + (chunkSize % 2);
    }
  }
  return null;
}

export function readAudioTags(arrayBuffer) {
  try {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    const loc = findID3Tag(bytes, view);
    if (!loc) return {};
    return parseID3Frames(bytes, view, loc.tagStart, loc.tagSize, loc.majorVersion);
  } catch (e) {
    return {};
  }
}

const KNOWN_PROS = ['ASCAP', 'BMI', 'SESAC', 'GMR', 'SOCAN'];

export function extractPublisherAndPro(frames) {
  const raw = frames.TIT3 || frames.TPUB || frames.TIT1 || '';
  const combined = [frames.TIT1, frames.TIT3, frames.TPUB, frames.TCOM].filter(Boolean).join(' | ');
  let publisher = raw.replace(/^US SUB PUB:\s*/i, '').replace(/^ORIGINAL PUB:\s*/i, '').trim();
  const isSinglePublisher = !publisher.includes('/');
  if (isSinglePublisher) {
    publisher = publisher.replace(/\s*\([^)]*\)\s*$/, '').trim();
  }

  // SESAC gets flagged wherever it shows up — even in a split-rights track —
  // since a track that's part-SESAC is still not clear to use.
  if (/\bSESAC\b/i.test(combined)) {
    return { publisher, pro: 'SESAC' };
  }

  if (isSinglePublisher) {
    const proMatches = [...raw.matchAll(/\(([^)]+)\)/g)].map((m) => m[1].trim().toUpperCase());
    if (proMatches.length === 1 && KNOWN_PROS.includes(proMatches[0])) {
      return { publisher, pro: proMatches[0] };
    }
  } else {
    // Split-rights track — no single confident PRO, but default to the first
    // listed one rather than leaving it blank (common case, not the exception).
    const proMatches = [...raw.matchAll(/\(([^)]+)\)/g)].map((m) => m[1].trim().toUpperCase());
    const firstKnown = proMatches.find((p) => KNOWN_PROS.includes(p));
    if (firstKnown) return { publisher, pro: firstKnown };
  }
  return { publisher, pro: '' };
}
