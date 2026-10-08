const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

export function distTag(version) {
    const match = SEMVER.exec(version);
    if (!match) {
        throw new Error(`Invalid version: ${JSON.stringify(version)}`);
    }
    return match[1] ? "rc" : "latest";
}

if (import.meta.url === `file://${process.argv[1]}`) {
    console.log(distTag(process.argv[2]));
}
