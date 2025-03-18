const axios = require('axios');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

class Account {
  constructor(token, extensionId, proxy = null) {
    this.token = token;
    this.extensionId = extensionId;
    this.proxy = proxy;
    this.api = this.createApiInstance();
    this.stats = {
      connectCount: 0,
      livenessCount: 0,
      statsChecks: 0,
      totalPoints: 0,
      referralPoints: 0,
      lastUpdated: null,
      startTime: new Date(),
      earningsTotal: 0,
      connectedNodesRewards: 0,
      connectedNodesCount: 0
    };
  }

  createApiInstance() {
    const config = {
      baseURL: 'https://api.exeos.network',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'authorization': `Bearer ${this.token}`,
        'content-type': 'application/json'
      }
    };
    
    if (this.proxy) {
      const agent = this.proxy.protocol.includes('socks') ?
        new SocksProxyAgent(this.proxy.url) :
        new HttpsProxyAgent(this.proxy.url);
      config.httpsAgent = agent;
    }
    
    return axios.create(config);
  }
}

const colors = {
  reset: "\x1b[0m",
  fg: {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m"
  }
};

const config = {
  logFilePath: path.join(__dirname, 'exeos-bot.log'),
  livenessDelay: 5000,
  livenessInterval: 15000,
  connectInterval: 60000
};

function parseProxy(proxyString) {
  const regex = /^(https?|socks[4-5]):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/;
  const match = proxyString.match(regex);
  if (!match) return null;
  
  const [, protocol, username, password, host, port] = match;
  return {
    protocol,
    url: `${protocol}://${username ? `${username}:${password}@` : ''}${host}:${port}`,
    host,
    port: Number(port),
    auth: username && password ? { username, password } : null
  };
}

function loadFileLines(filePath) {
  return fs.existsSync(filePath) ?
    fs.readFileSync(filePath, 'utf-8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0) :
    [];
}

async function selectExtensionId() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const extensionIds = loadFileLines('id.txt');
  
  return new Promise((resolve) => {
    if (extensionIds.length > 0) {
      console.log('\nAvailable Extension IDs from id.txt:');
      extensionIds.forEach((id, index) => {
        console.log(`${index + 1}. ${id}`);
      });
      console.log(`${extensionIds.length + 1}. Enter manually`);
      
      rl.question('\nSelect an option (number) or type an Extension ID: ', (answer) => {
        const choice = parseInt(answer);
        
        if (!isNaN(choice) && choice >= 1 && choice <= extensionIds.length) {
          resolve(extensionIds[choice - 1]);
          rl.close();
        } else if (!isNaN(choice) && choice === extensionIds.length + 1) {
          rl.question('Enter Extension ID manually: ', (manualId) => {
            if (manualId.trim().length > 0) {
              resolve(manualId.trim());
            } else {
              console.log('Invalid input, using first ID from file');
              resolve(extensionIds[0] || '');
            }
            rl.close();
          });
        } else if (answer.trim().length > 0) {
          resolve(answer.trim());
          rl.close();
        } else {
          console.log('Invalid input, using first ID from file');
          resolve(extensionIds[0] || '');
          rl.close();
        }
      });
    } else {
      rl.question('No IDs found in id.txt. Enter Extension ID manually: ', (manualId) => {
        if (manualId.trim().length > 0) {
          resolve(manualId.trim());
        } else {
          console.log('No valid ID provided');
          resolve('');
        }
        rl.close();
      });
    }
  });
}

async function loadAccounts() {
  const tokens = loadFileLines('token.txt');
  const proxies = loadFileLines('proxies.txt').map(parseProxy).filter(p => p);
  
  if (tokens.length === 0) {
    log('ERROR', 'No tokens found in token.txt');
    return [];
  }

  const selectedExtensionId = await selectExtensionId();
  if (!selectedExtensionId) {
    log('ERROR', 'No valid Extension ID selected');
    return [];
  }

  const accounts = [];
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const proxy = proxies[i % proxies.length] || null;
    accounts.push(new Account(token, selectedExtensionId, proxy));
  }
  
  return accounts;
}

function clearScreen() {
  console.clear();
}

function log(type, message, accountIndex = '') {
  const timestamp = new Date().toISOString();
  let coloredMessage = `[${timestamp}] [${accountIndex}] `;
  
  switch(type) {
    case 'CONNECT': coloredMessage += `${colors.fg.green}[CONNECT]${colors.reset} ${message}`; break;
    case 'LIVENESS': coloredMessage += `${colors.fg.blue}[LIVENESS]${colors.reset} ${message}`; break;
    case 'STATS': coloredMessage += `${colors.fg.magenta}[STATS]${colors.reset} ${message}`; break;
    case 'POINTS': coloredMessage += `${colors.fg.yellow}[POINTS]${colors.reset} ${message}`; break;
    case 'ERROR': coloredMessage += `${colors.fg.red}[ERROR]${colors.reset} ${message}`; break;
    default: coloredMessage += `${colors.fg.cyan}[INFO]${colors.reset} ${message}`;
  }
  
  console.log(coloredMessage);
  fs.appendFileSync(config.logFilePath, `[${timestamp}] [${type}] [${accountIndex}] ${message}\n`);
}

async function getPublicIP(account) {
  try {
    const response = await account.api.get('https://api.ipify.org/?format=json');
    return response.data.ip;
  } catch (error) {
    log('ERROR', `Failed to get public IP: ${error.message}`, `Account ${account.token.slice(0, 10)}...`);
    return null;
  }
}

async function checkAccountInfo(account) {
  try {
    const response = await account.api.get('/account/web/me');
    const data = response.data.data;
    
    if (data) {
      account.stats.totalPoints = data.points || 0;
      account.stats.referralPoints = data.referralPoints || 0;
      account.stats.earningsTotal = parseFloat(data.earningsTotal) || 0;
      
      account.stats.connectedNodesRewards = 0;
      account.stats.connectedNodesCount = 0;
      
      if (data.networkNodes && Array.isArray(data.networkNodes)) {
        data.networkNodes.forEach(node => {
          if (node.status === "Connected") {
            account.stats.connectedNodesRewards += parseFloat(node.totalRewards) || 0;
            account.stats.connectedNodesCount++;
          }
        });
      }
      
      account.stats.lastUpdated = new Date();
      log('POINTS', `Total Points: ${account.stats.totalPoints} | Referral Points: ${account.stats.referralPoints}`, `Account ${account.token.slice(0, 10)}...`);
    }
    return data;
  } catch (error) {
    log('ERROR', `Failed to get account info: ${error.message}`, `Account ${account.token.slice(0, 10)}...`);
    return null;
  }
}

async function checkStats(account) {
  try {
    const response = await account.api.post('/extension/stats', { extensionId: account.extensionId });
    account.stats.statsChecks++;
    log('STATS', `Checked for ${account.extensionId}`, `Account ${account.token.slice(0, 10)}...`);
    return response.data;
  } catch (error) {
    log('ERROR', `Failed to check stats: ${error.message}`, `Account ${account.token.slice(0, 10)}...`);
    return null;
  }
}

async function checkLiveness(account) {
  try {
    const response = await account.api.post('/extension/liveness', { extensionId: account.extensionId });
    account.stats.livenessCount++;
    log('LIVENESS', `OK for ${account.extensionId}`, `Account ${account.token.slice(0, 10)}...`);
    return response.data;
  } catch (error) {
    log('ERROR', `Failed to check liveness: ${error.message}`, `Account ${account.token.slice(0, 10)}...`);
    return null;
  }
}

async function connectExtension(account, ip) {
  try {
    const response = await account.api.post('/extension/connect', { ip, extensionId: account.extensionId });
    account.stats.connectCount++;
    log('CONNECT', `Success for ${account.extensionId} from ${ip}`, `Account ${account.token.slice(0, 10)}...`);
    return response.data;
  } catch (error) {
    log('ERROR', `Failed to connect: ${error.message}`, `Account ${account.token.slice(0, 10)}...`);
    return null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function livenessSequence(account) {
  log('INFO', `Running liveness sequence for: ${account.extensionId}`, `Account ${account.token.slice(0, 10)}...`);
  await checkLiveness(account);
  await sleep(config.livenessDelay);
  await checkLiveness(account);
  await sleep(config.livenessDelay);
  await checkLiveness(account);
  await sleep(config.livenessDelay);
  await checkLiveness(account);
}

async function connectSequence(account) {
  const ip = await getPublicIP(account);
  if (ip) {
    await connectExtension(account, ip);
    await checkStats(account);
    await checkAccountInfo(account);
  } else {
    log('ERROR', `Cannot connect: No IP found`, `Account ${account.token.slice(0, 10)}...`);
  }
  displayStats(account);
}

function formatDuration(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function displayStats(account) {
  clearScreen();
  const uptime = formatDuration(new Date() - account.stats.startTime);
  const lastUpdate = account.stats.lastUpdated ? account.stats.lastUpdated.toLocaleTimeString() : 'Never';
  
  console.log(`${colors.fg.cyan}===== ExeOS Auto Bot | Airdrop Insiders ${account.token.slice(0, 10)}... =====${colors.reset}`);
  console.log(`Points:`);
  console.log(`  Earnings Total:    ${colors.fg.yellow}${account.stats.earningsTotal.toFixed(2)}${colors.reset}`);
  console.log(`  Referral Points:   ${colors.fg.green}${account.stats.referralPoints.toLocaleString()}${colors.reset}`);
  console.log(`  Connected Rewards: ${colors.fg.yellow}${account.stats.connectedNodesRewards.toFixed(2)}${colors.reset} (${account.stats.connectedNodesCount} nodes)`);
  console.log(`${colors.fg.cyan}==================${colors.reset}`);
  console.log(`Stats:`);
  console.log(`  Uptime:            ${uptime}`);
  console.log(`  Connect Count:     ${colors.fg.green}${account.stats.connectCount}${colors.reset}`);
  console.log(`  Liveness Count:    ${colors.fg.blue}${account.stats.livenessCount}${colors.reset}`);
  console.log(`  Stats Checks:      ${colors.fg.magenta}${account.stats.statsChecks}${colors.reset}`);
  console.log(`  Last Updated:      ${lastUpdate}`);
  console.log(`  Proxy:             ${account.proxy ? account.proxy.url : 'None'}`);
  console.log(`${colors.fg.cyan}==================${colors.reset}`);
}

async function runBot() {
  if (!fs.existsSync(config.logFilePath)) {
    fs.writeFileSync(config.logFilePath, '');
  }

  const accounts = await loadAccounts();
  if (accounts.length === 0) {
    log('ERROR', 'No accounts loaded. Please check token.txt and ensure valid Extension ID');
    return;
  }

  log('INFO', `Starting bot with ${accounts.length} accounts using Extension ID: ${accounts[0].extensionId}...`);
  
  accounts.forEach((account, index) => {
    log('INFO', `Starting Account ${index + 1}${account.proxy ? ' (Proxy: ' + account.proxy.url + ')' : ''}`);
    
    connectSequence(account);
    
    setInterval(() => livenessSequence(account), config.livenessInterval);
    setInterval(() => connectSequence(account), config.connectInterval);
  });
}

process.on('uncaughtException', (error) => {
  log('ERROR', `Uncaught exception: ${error.message}`);
});

process.on('unhandledRejection', (reason) => {
  log('ERROR', `Unhandled rejection: ${reason}`);
});

runBot().catch(error => {
  log('ERROR', `Failed to start bot: ${error.message}`);
});