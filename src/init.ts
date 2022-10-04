export async function main(ns: NS) {
    const AUTO_LAUNCH = ["/infra/autopwn.js", "/hack/manager.js"];

    for (const script of AUTO_LAUNCH) {
        await ns.exec(script, ns.getHostname(), 1);
    }
}
