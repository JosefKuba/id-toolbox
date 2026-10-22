const path = require("path");

const MAX_REMOTE_URL_LENGTH = 2048;
const MAX_ID_QUERY_CHARS = 2000000;
const MAX_ZIP_ENTRIES = 200000;
const MAX_ZIP_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_DOWNLOAD_BYTES = 1024 * 1024 * 1024;

function isAllowedRemoteUrl(value) {
    if (typeof value !== "string") return false;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_REMOTE_URL_LENGTH) return false;
    let parsed;
    try {
        parsed = new URL(trimmed);
    } catch {
        return false;
    }
    if (parsed.username || parsed.password) return false;
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (!parsed.hostname) return false;
    return true;
}

function friendIndexUrl(remoteUrl) {
    if (!isAllowedRemoteUrl(remoteUrl)) return null;
    const base = remoteUrl.endsWith("/") ? remoteUrl : `${remoteUrl}/`;
    let target;
    try {
        target = new URL("friendId.json", base);
    } catch {
        return null;
    }
    if (!isAllowedRemoteUrl(target.href)) return null;
    return target.href;
}

function isGoogleFileId(value) {
    return typeof value === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(value);
}

function isInsideDirectory(rootDir, candidate) {
    if (typeof candidate !== "string" || candidate.includes("\0")) return false;
    const root = path.resolve(rootDir);
    const target = path.resolve(candidate);
    const relative = path.relative(root, target);
    if (relative === "") return true;
    return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function resolveFriendIdFile(rootDir, id) {
    if (typeof id !== "string") return null;
    const trimmed = id.trim();
    if (!trimmed || trimmed.includes("\0") || trimmed === "." || trimmed === "..") return null;
    const root = path.resolve(rootDir);
    const target = path.resolve(root, trimmed);
    const relative = path.relative(root, target);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
    if (relative.includes(path.sep) || relative.includes("/") || relative.includes("\\")) return null;
    return target;
}

function safeZipDestination(rootDir, entryPath) {
    if (typeof entryPath !== "string" || entryPath.length === 0 || entryPath.includes("\0")) return null;
    if (entryPath.includes(":") || entryPath.startsWith("\\\\") || entryPath.startsWith("//")) return null;
    if (path.win32.isAbsolute(entryPath) || path.posix.isAbsolute(entryPath)) return null;
    const root = path.resolve(rootDir);
    const target = path.resolve(root, entryPath);
    if (!isInsideDirectory(root, target)) return null;
    return target;
}

function errorMessage(error) {
    if (!error) return "unknown error";
    if (typeof error === "string") return error.slice(0, 300);
    if (typeof error.message === "string" && error.message) return error.message.slice(0, 300);
    return "unknown error";
}

module.exports = {
    MAX_ID_QUERY_CHARS,
    MAX_ZIP_ENTRIES,
    MAX_ZIP_UNCOMPRESSED_BYTES,
    MAX_DOWNLOAD_BYTES,
    isAllowedRemoteUrl,
    friendIndexUrl,
    isGoogleFileId,
    isInsideDirectory,
    resolveFriendIdFile,
    safeZipDestination,
    errorMessage,
};
