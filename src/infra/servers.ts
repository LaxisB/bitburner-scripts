import * as fmt from "utils/format";
const prefix = `NODE`;

export async function main(ns: NS) {
    ns.disableLog("ALL");
    const max = ns.getPurchasedServerLimit();
    while (true) {
        const player = ns.getPlayer();
        const maxCost = player.money * 0.1;

        const servers = ns
            .getPurchasedServers()
            .map((server) => ({ host: server, ram: ns.getServerMaxRam(server) }))
            .sort((a, b) => a.ram - b.ram);

        // get max pow
        let pow = 4;
        do {
            pow += 1;
        } while (ns.getPurchasedServerCost(2 ** pow) < maxCost);
        const targetRam = 2 ** pow;

        if (targetRam <= servers[0].ram) {
            // not a n increase
            await ns.sleep(5_000);
            continue;
        }
        if (servers.length >= max) {
            const toDelete = servers[0];
            ns.printf("reached limit. deleting smallest node (ram=%s)", fmt.formatRam(toDelete.ram));
            ns.killall(toDelete.host);
            const res = ns.deleteServer(toDelete.host);
            if (!res) {
                ns.printf("couldn't delete...");
                await ns.sleep(10_000);
                continue;
            }
        }
        ns.printf("[%s] bought a %s box", new Date().toLocaleTimeString(), fmt.formatRam(2 ** pow));
        ns.purchaseServer(prefix, targetRam);
        await ns.sleep(5_000);
    }
}
