import type { Server } from "utils/domain.js";

/**
 * this is needlessly async to avoid limits of the very shallow stack
 */
export async function crawlServers(
    ns: NS,
    host: string,
    depth = 10
): Promise<Server[]> {
    async function extend(
        ns: NS,
        host: string,
        parent: string,
        list: Server[],
        depth = 1
    ) {
        const s = await ns.getServer(host);
        list.push(s);

        const children = await ns.scan(host).filter((h) => parent !== h);
        children.forEach((host) => {
            list.push(ns.getServer(host));
        });

        if (depth > 0) {
            for (const child of children) {
                await extend(ns, child, host, list, depth - 1);
            }
        }
        return;
    }

    const list: Server[] = [];
    await extend(ns, host, "", list, depth);

    return list;
}
