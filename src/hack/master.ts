import { HOME } from "utils/constants";
import { crawlServers } from "utils/servers";
import type { Server } from "utils/domain";
import { table, TableConfig } from "utils/table";
import { PORT } from "hack/analytics";
import type { SlaveArgs } from "./slave";

const SCRIPT_SLAVE = "/hack/slave.js";
const DEPLOY = ["utils.js", SCRIPT_SLAVE];

interface MasterArgs {
    sleep: number;
}
interface ActionForecast {
    action: string;
    res: number;
    threads: number;
    dur: number;
    time: number;
}

export async function main(ns: NS) {
    ns.disableLog("ALL");
    ns.tail();

    const args = ns.flags([["sleep", 1000]]) as any as MasterArgs;

    const activity = new WeakMap<Server, ActionForecast>();
    const available = new Set<string>();
    const allServers = await crawlServers(ns, HOME);
    const servers: Record<string, Server> = allServers
        .filter((server) => server.moneyMax > 0)
        .sort((a, b) => a.hostname.localeCompare(b.hostname))
        .reduce(
            (acc: Record<string, Server>, curr: Server) => ({
                ...acc,
                [curr.hostname]: curr,
            }),
            {}
        );

    for (const hostname in servers) {
        ns.scp(DEPLOY, hostname, HOME);
        available.add(hostname);
    }

    while (true) {
        Object.values(servers).forEach((server) => {
            Object.assign(server, ns.getServer(server.hostname));

            if (ns.scriptRunning(SCRIPT_SLAVE, server.hostname)) {
                available.delete(server.hostname);
            } else {
                available.add(server.hostname);
            }
        });
        const todo = Array.from(available).map((host) => servers[host]);
        await execute(ns, todo, activity);
        await log(ns, servers, activity);
        await ns.sleep(args.sleep);
    }
}

function log(
    ns: NS,
    servers: Record<string, Server>,
    activity: WeakMap<Server, ActionForecast>
) {
    const items = Object.values(servers)
        .filter((server) => server.hasAdminRights)
        .filter((server, i, a) => a.indexOf(server) === i) //dedupe
        .sort((a, b) => a.hostname.localeCompare(b.hostname))
        .map((server) => {
            const act = activity.get(server);
            return {
                hostname: server.hostname,
                org: server.organizationName,
                money: server.moneyAvailable,
                forecast: act,
            };
        });

    const tableConfig: TableConfig<typeof items[0]> = {
        columns: [
            {
                alignLeft: true,
                header: "",
                width: 25,
                key: "hostname",
            },
            {
                header: "funds",
                width: 15,
                getter: (item) => ns.nFormat(item.money, "0,0.00$"),
            },
            {
                header: "action",
                width: 20,
                getter: (item) => {
                    if (!item.forecast || item.forecast.action == "none") {
                        return "";
                    }
                    return `${
                        item.forecast.action
                    }(${item.forecast.res.toPrecision(2)}) x${
                        item.forecast.threads
                    }`;
                },
            },
            {
                header: "remaining",
                width: 20,
                getter: (item) =>
                    item.forecast && item.forecast.time > Date.now()
                        ? ns.tFormat(item.forecast.time - Date.now(), false)
                        : "",
            },
        ],
        padding: 2,
    };

    table(ns, items, tableConfig);
}

async function execute(
    ns: NS,
    servers: Server[],
    activity: WeakMap<Server, ActionForecast>
) {
    for (const server of servers) {
        if (server.requiredHackingSkill > ns.getHackingLevel()) {
            continue;
        }
        // run hack on servers themself for now
        try {
            const ram = getUsableRam(ns, server);
            const needed = ns.getScriptRam(SCRIPT_SLAVE, server.hostname);
            const maxThreads = Math.floor(ram / needed);
            if (!maxThreads) {
                activity.set(server, {
                    action: "none",
                    dur: 0,
                    res: 0,
                    threads: 1,
                    time: Date.now(),
                });
                continue;
            }

            const action = getNextAction(ns, server, maxThreads);

            activity.set(server, action);

            if (action.action === "hack") {
                await ns.writePort(PORT, JSON.stringify(action));
            }
            await runSlave(ns, {
                cmd: action.action,
                runner: server.hostname,
                target: server.hostname,
                threads: maxThreads,
            });
        } catch (e) {
            ns.tprintf(e as any);
            ns.printf("failed running %s", server.hostname);
        }
    }
}

function getUsableRam(ns: NS, server: Server) {
    const BUFFER = 3; // keep 2gb free no matter what
    return Math.max(0, server.maxRam - BUFFER - server.ramUsed);
}

function getNextAction(
    ns: NS,
    server: Server,
    maxThreads: number
): ActionForecast {
    const secCurr = ns.getServerSecurityLevel(server.hostname);
    const secMin = ns.getServerMinSecurityLevel(server.hostname);
    const secDelta = ns.weakenAnalyze(maxThreads, server.cpuCores);

    const moneyMax = server.moneyMax || 1;
    const moneyCurr = server.moneyAvailable || 1;
    const moneyTarget = moneyMax - moneyCurr;
    // check how often we'd need to grow to max out money
    const moneyDelta = ns.growthAnalyze(
        server.hostname,
        moneyTarget / moneyCurr || 1,
        server.cpuCores
    );

    const hackTime = ns.getHackTime(server.hostname);
    const hackUsable =
        server.hasAdminRights &&
        server.requiredHackingSkill <= ns.getHackingLevel();

    if (secCurr - secDelta >= secMin) {
        return {
            action: "weaken",
            res: secDelta,
            threads: maxThreads,
            time: Date.now() + ns.getWeakenTime(server.hostname),
            dur: ns.getWeakenTime(server.hostname),
        };
    }

    if (moneyDelta > 1 || !hackUsable) {
        return {
            action: "grow",
            res: 0,
            threads: maxThreads,
            time: Date.now() + ns.getGrowTime(server.hostname),
            dur: ns.getGrowTime(server.hostname),
        };
    }

    return {
        action: "hack",
        res: ns.hackAnalyze(server.hostname) * maxThreads,
        threads: maxThreads,
        time: Date.now() + hackTime,
        dur: hackTime,
    };
}

async function runSlave(ns: NS, opts: SlaveArgs) {
    const args = Object.keys(opts).flatMap((key) => [
        `--${key}`,
        (opts as Record<string, any>)[key],
    ]);
    return await ns.exec(SCRIPT_SLAVE, opts.runner, opts.threads, ...args);
}
