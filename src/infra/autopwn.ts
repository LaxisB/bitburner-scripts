/* eslint-disable no-empty */
import { crawlServers } from "utils/servers";
import { HOME } from "utils/constants";

export async function main(ns: NS) {
    ns.disableLog("ALL");
    const servers = await crawlServers(ns, HOME, 10);

    while (true) {
        const todo = servers.filter(
            (server) => !server.hasAdminRights && server.requiredHackingSkill <= ns.getHackingLevel()
        );

        for (const server of todo) {
            const host = server.hostname;
            try {
                ns.brutessh(host);
            } catch (e) {}
            try {
                ns.ftpcrack(host);
            } catch (e) {}
            try {
                ns.relaysmtp(host);
            } catch (e) {}
            try {
                ns.httpworm(host);
            } catch (e) {}
            try {
                ns.sqlinject(host);
            } catch (e) {}
            try {
                ns.nuke(host);
                ns.print(`pwned ${host}`);
            } catch (e) {}
        }

        await ns.sleep(5000);
    }
}
