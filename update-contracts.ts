import * as YAML from "yaml";
import * as fs from "fs";

const YAML_PATH = "./subgraph.template.yaml";
const OUT_PATH = "./subgraph.yaml";
const DEFAULT_NETWORK = "4";
const ENV_TO_NETWORK: any = {
  "srm-dev": "4",
  "mainnet": "1",
  "ganache": "7777",
  "srm-staging": "4",
  "local-kovan": "42",
  "srm-production": "4",
};
const NETWORK_NAMES: any = {
  "7777": "ganache",
  "4": "rinkeby",
  "42": "kovan",
  "1": "mainnet",
};
const MANUAL_FILE_UPDATES: string[] = [];
const ENV = process.argv[2] || "srm-dev";

updateSubgraphYaml();

updateManualFiles();

function getContractNames(networkId: string) {
  const contract = require(`./abis/contracts.json`);
  const network = contract.environment[networkId];

  return Object.getOwnPropertyNames(network);
}

function getConfigValue(name: string, networkId: string, value: string = "address") {
  const contract = require(`./abis/contracts.json`);
  const network = contract.environment[networkId];

  if (!network[name]) {
    console.error(`No address found in config for contract: ${name}`);

    process.exit(1);
  }

  if (value === "address") {
    return network[name][value] || network[name];
  }

  return network[name][value] || network[value];
}

function updateSubgraphYaml() {
  const yaml = YAML.parse(fs.readFileSync(YAML_PATH, "utf8"));

  for (const source of yaml.dataSources) {
    const name = source.source.abi;

    source.network = NETWORK_NAMES[ENV_TO_NETWORK[ENV] || DEFAULT_NETWORK];
    source.source.address = getConfigValue(name, ENV);

    source.source.startBlock = getConfigValue(name, ENV, "defaultStartBlock");
  }

  if (yaml.templates) {
    for (const template of yaml.templates) {
      template.network = NETWORK_NAMES[ENV_TO_NETWORK[ENV] || DEFAULT_NETWORK];
    }
  }

  fs.writeFileSync(OUT_PATH, YAML.stringify(yaml));
}

function updateManualFiles() {
  for (const file of MANUAL_FILE_UPDATES) {
    let source = fs.readFileSync(file, "utf8");

    for (const contract of getContractNames(ENV)) {
      source = source.replace(
        new RegExp(`__${contract}__`, "g"),
        getConfigValue(contract, ENV_TO_NETWORK[ENV] || DEFAULT_NETWORK)
      );
    }

    fs.writeFileSync(file, source);
  }
}
