import * as YAML from "yaml";
import * as fs from "fs";

const YAML_PATH = "./subgraph.template.yaml";
const OUT_PATH = "./subgraph.yaml";
const DEFAULT_NETWORK = "5";
const ENV_TO_NETWORK: any = {
  "srm-dev": "80001",
  "mainnet": "1",
  "ganache": "7777",
  "srm-staging": "5",
  "local-mumbai": "80001",
  "local-goerli": "5",
  "srm-production": "137",
  "srm-dev-sepolia": "11155111",
  "srm-staging-sepolia": "11155111",
  "srm-staging-arbitrum": "421613",
  "srm-production-arbitrum": "42161",
  "srm-production-zk-evm": "1101",
};
const NETWORK_NAMES: any = {
  "7777": "ganache",
  "4": "rinkeby",
  "5": "goerli",
  "42": "kovan",
  "1": "mainnet",
  "137": "matic",
  "80001": "mumbai",
  "11155111": "sepolia",
  "1101": "polygon-zkevm",
  "1442": "polygon-zkevm-testnet",
  "4002": "fantom-testnet",
  "43113": "fuji",
  "43114": "avalanche",
  "42161": "arbitrum-one",
  "421613": "arbitrum-goerli",
};
const MANUAL_FILE_UPDATES: string[] = [];
const ENV = process.argv[2] || "srm-dev";
const NETWORK = process.argv[3];

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
  const targetNetwork = Object.values(NETWORK_NAMES).some(value => value === NETWORK) ? NETWORK : NETWORK_NAMES[NETWORK || ENV_TO_NETWORK[ENV] || DEFAULT_NETWORK];

  console.info(`Environment: ${ENV}, Chain: ${targetNetwork}`);

  if (!ENV || !targetNetwork) {
    console.error('Error: Can not find specified config.');
    process.exit(1);
  }

  const yaml = YAML.parse(fs.readFileSync(YAML_PATH, "utf8"));

  for (const source of yaml.dataSources) {
    const name = source.source.abi;

    source.network = targetNetwork;
    source.source.address = getConfigValue(name, ENV);

    source.source.startBlock = getConfigValue(name, ENV, "defaultStartBlock");
  }

  if (yaml.templates) {
    for (const template of yaml.templates) {
      template.network = targetNetwork;
    }
  }

  fs.writeFileSync(OUT_PATH, YAML.stringify(yaml));
}

function updateManualFiles() {
  const targetNetworkId = NETWORK || ENV_TO_NETWORK[ENV] || DEFAULT_NETWORK;

  for (const file of MANUAL_FILE_UPDATES) {
    let source = fs.readFileSync(file, "utf8");

    for (const contract of getContractNames(ENV)) {
      source = source.replace(
        new RegExp(`__${contract}__`, "g"),
        getConfigValue(contract, targetNetworkId)
      );
    }

    fs.writeFileSync(file, source);
  }
}
