import { homedir, platform } from 'os';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec } from "node:child_process";

const getVersion = async () => {
    try {
        if (process.env.npm_package_version) {
            return process.env.npm_package_version;
        }
        
        // Check if version.js exists in dist directory (when running from root)
        const versionPath = join(__dirname, 'version.js');
        if (existsSync(versionPath)) {
            const { VERSION } = await import(versionPath);
            return VERSION;
        }

        const packageJsonPath = join(__dirname, 'package.json');
        if (existsSync(packageJsonPath)) {
            const packageJsonContent = readFileSync(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageJsonContent);
            if (packageJson.version) {
                return packageJson.version;
            }
        }
        
        return 'unknown';
    } catch (error) {
        return 'unknown';
    }
};

// Fix for Windows ESM path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Setup logging early to capture everything
const LOG_FILE = join(__dirname, 'setup.log');

function logToFile(message, isError = false) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ${isError ? 'ERROR: ' : ''}${message}\n`;
    try {
        appendFileSync(LOG_FILE, logMessage);
        process.stdout.write(`${message}\n`);
    } catch (err) {
        // Last resort error handling
        process.stderr.write(`Failed to write to log file: ${err.message}\n`);
    }
}

// Setup global error handlers (simplified, no tracking)
process.on('uncaughtException', (error) => {
    logToFile(`Uncaught exception: ${error.message}`, true);
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    logToFile(`Unhandled rejection: ${String(reason)}`, true);
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

// Function to check for debug mode argument
function isDebugMode() {
    return process.argv.includes('--debug');
}

// Determine OS and set appropriate config path
const os = platform();
const isWindows = os === 'win32';
let claudeConfigPath;

switch (os) {
    case 'win32':
        claudeConfigPath = join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json');
        break;
    case 'darwin':
        claudeConfigPath = join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
        break;
    case 'linux':
        claudeConfigPath = join(homedir(), '.config', 'Claude', 'claude_desktop_config.json');
        break;
    default:
        // Fallback for other platforms
        claudeConfigPath = join(homedir(), '.claude_desktop_config.json');
}

async function execAsync(command) {
    return new Promise((resolve, reject) => {
        // Use PowerShell on Windows for better Unicode support and consistency
        const actualCommand = isWindows
        ? `cmd.exe /c ${command}`
        : command;

        exec(actualCommand, { timeout: 10000 }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve({ stdout, stderr });
        });
    });
}

async function restartClaude() {
    try {
        const platform = process.platform;
        
        // Try to kill Claude process first
        try {
            switch (platform) {
                case "win32":
                    await execAsync(`taskkill /F /IM "Claude.exe"`);
                    break;
                case "darwin":
                    await execAsync(`killall "Claude"`);
                    break;
                case "linux":
                    await execAsync(`pkill -f "claude"`);
                    break;
            }
            logToFile("Claude process terminated successfully");
        } catch (killError) {
            // It's okay if Claude isn't running
            logToFile("Claude process not found or already terminated");
        }

        // Wait a bit to ensure process termination
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Try to start Claude
        try {
            if (platform === "win32") {
                // Windows - note it won't actually start Claude
                logToFile("Windows: Claude restart skipped - requires manual restart");
            } else if (platform === "darwin") {
                await execAsync(`open -a "Claude"`);
                logToFile("\n✅ Claude has been restarted automatically!");
            } else if (platform === "linux") {
                await execAsync(`claude`);
                logToFile("\n✅ Claude has been restarted automatically!");
            } else {
                logToFile('\nTo use the server restart Claude if it\'s currently running\n');
            }
            
            logToFile("\n✅ Installation successfully completed! Thank you for using Desktop Commander!\n");
            logToFile('\nThe server is available as "desktop-commander" in Claude\'s MCP server list');
            
            logToFile("Future updates will install automatically — no need to run this setup again.\n\n");
            logToFile("💬 Need help or found an issue? Join our community: https://discord.com/invite/kQ27sNnZr7\n\n")
        } catch (startError) {
            throw startError;
        }
    } catch (error) {
        logToFile(`Failed to restart Claude: ${error}. Please restart it manually.`, true);
        logToFile(`If Claude Desktop is not installed use this link to download https://claude.ai/download`, true);
    }
}

// Main function to export for ESM compatibility
export default async function setup() {
    const debugMode = isDebugMode();

    // Print ASCII art for DESKTOP COMMANDER
    console.log('\n');
    console.log('██████╗ ███████╗███████╗██╗  ██╗████████╗ ██████╗ ██████╗     ██████╗ ██████╗ ███╗   ███╗███╗   ███╗ █████╗ ███╗   ██╗██████╗ ███████╗██████╗ ');
    console.log('██╔══██╗██╔════╝██╔════╝██║ ██╔╝╚══██╔══╝██╔═══██╗██╔══██╗   ██╔════╝██╔═══██╗████╗ ████║████╗ ████║██╔══██╗████╗  ██║██╔══██╗██╔════╝██╔══██╗');
    console.log('██║  ██║█████╗  ███████╗█████╔╝    ██║   ██║   ██║██████╔╝   ██║     ██║   ██║██╔████╔██║██╔████╔██║███████║██╔██╗ ██║██║  ██║█████╗  ██████╔╝');
    console.log('██║  ██║██╔══╝  ╚════██║██╔═██╗    ██║   ██║   ██║██╔═══╝    ██║     ██║   ██║██║╚██╔╝██║██║╚██╔╝██║██╔══██║██║╚██╗██║██║  ██║██╔══╝  ██╔══██╗');
    console.log('██████╔╝███████╗███████║██║  ██╗   ██║   ╚██████╔╝██║        ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║██║  ██║██║ ╚████║██████╔╝███████╗██║  ██║');
    console.log('╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝         ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝ ╚══════╝╚═╝  ╚═╝');
    console.log('\n');

    if (debugMode) {
        logToFile('Debug mode enabled. Will configure with Node.js inspector options.');
    }

    try {
        // Check if config directory exists and create it if necessary
        const configDir = dirname(claudeConfigPath);

        if (!existsSync(configDir)) {
            logToFile(`Creating config directory: ${configDir}`);
            mkdirSync(configDir, { recursive: true });
        }

        // Check if config file exists and create default if not
        let config;

        if (!existsSync(claudeConfigPath)) {
            logToFile(`Claude config file not found at: ${claudeConfigPath}`);
            logToFile('Creating default config file...');

            // Create default config with shell based on platform
            const defaultConfig = {
                "serverConfig": isWindows
                    ? {
                        "command": "cmd.exe",
                        "args": ["/c"]
                      }
                    : {
                        "command": "/bin/sh",
                        "args": ["-c"]
                      }
            };

            writeFileSync(claudeConfigPath, JSON.stringify(defaultConfig, null, 2));
            logToFile('Default config file created.');
            config = defaultConfig;
        } else {
            // Read existing config
            const configData = readFileSync(claudeConfigPath, 'utf8');
            config = JSON.parse(configData);
        }

        // Determine if running through npx or locally
        const isNpx = import.meta.url.includes('node_modules');

        // Fix Windows path handling for npx execution
        let serverConfig;

        if (debugMode) {
            // Use Node.js with inspector flag for debugging
            if (isNpx) {
                // Debug with npx
                logToFile('Setting up debug configuration with npx. The process will pause on start until a debugger connects.');
                // Add environment variables to help with debugging
                const debugEnv = {
                    "NODE_OPTIONS": "--trace-warnings --trace-exit",
                    "DEBUG": "*"
                };

                serverConfig = {
                    "command": isWindows ? "node.exe" : "node",
                    "args": [
                        "--inspect-brk=9229",
                        isWindows ?
                            join(process.env.APPDATA || '', "npm", "npx.cmd").replace(/\\/g, '\\\\') :
                            "$(which npx)",
                        "@wonderwhy-er/desktop-commander@latest"
                    ],
                    "env": debugEnv
                };
            } else {
                // Debug with local installation path
                const indexPath = join(__dirname, 'dist', 'index.js');
                logToFile('Setting up debug configuration with local path. The process will pause on start until a debugger connects.');
                // Add environment variables to help with debugging
                const debugEnv = {
                    "NODE_OPTIONS": "--trace-warnings --trace-exit",
                    "DEBUG": "*"
                };

                serverConfig = {
                    "command": isWindows ? "node.exe" : "node",
                    "args": [
                        "--inspect-brk=9229",
                        indexPath.replace(/\\/g, '\\\\') // Double escape backslashes for JSON
                    ],
                    "env": debugEnv
                };
            }
        } else {
            // Standard configuration without debug
            if (isNpx) {
                serverConfig = {
                    "command": isWindows ? "npx.cmd" : "npx",
                    "args": [
                        "@wonderwhy-er/desktop-commander@latest"
                    ]
                };
            } else {
                // For local installation, use absolute path to handle Windows properly
                const indexPath = join(__dirname, 'dist', 'index.js');
                serverConfig = {
                    "command": "node",
                    "args": [
                        indexPath.replace(/\\/g, '\\\\') // Double escape backslashes for JSON
                    ]
                };
            }
        }

        // Update the config
        // Initialize mcpServers if it doesn't exist
        if (!config.mcpServers) {
            config.mcpServers = {};
        }

        // Check if the old "desktopCommander" exists and remove it
        if (config.mcpServers.desktopCommander) {
            delete config.mcpServers.desktopCommander;
        }

        // Add or update the terminal server config with the proper name "desktop-commander"
        config.mcpServers["desktop-commander"] = serverConfig;

        // Write the updated config back
        writeFileSync(claudeConfigPath, JSON.stringify(config, null, 2), 'utf8');
        
        const appVersion = await getVersion()
        logToFile(`✅ Desktop Commander MCP v${appVersion} successfully added to Claude's configuration.`);
        logToFile(`Configuration location: ${claudeConfigPath}`);

        if (debugMode) {
            logToFile('\nTo use the debug server:\n1. Restart Claude if it\'s currently running\n2. The server will be available as "desktop-commander-debug" in Claude\'s MCP server list\n3. Connect your debugger to port 9229');
        }

        // Try to restart Claude
        await restartClaude();

        return true;
    } catch (error) {
        logToFile(`Error updating Claude configuration: ${error}`, true);
        return false;
    }
}

// Allow direct execution
if (process.argv.length >= 2 && process.argv[1] === fileURLToPath(import.meta.url)) {
    setup().then(success => {
        if (!success) {
            setTimeout(() => {
                process.exit(1);
            }, 1000);
        }
    }).catch(error => {
        logToFile(`Fatal error: ${error}`, true);
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    });
}
