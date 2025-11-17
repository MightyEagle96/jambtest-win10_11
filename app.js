import os from "os";
import { execSync } from "child_process";
import express from "express";
import cors from "cors";

const app = express();
const PORT = 4001;

function getPrimaryIpAddress() {
  const nets = os.networkInterfaces();

  const virtualPatterns = [
    /docker/i,
    /veth/i,
    /br-/i,
    /virbr/i,
    /nat/i,
    /vmware/i,
    /hyper-v/i,
    /vbox/i,
    /virtual/i,
    /wsl/i,
    /tun/i,
    /tap/i,
  ];

  const isVirtual = (name) =>
    virtualPatterns.some((pattern) => pattern.test(name));

  const isPhysicalMac = (mac) => {
    if (!mac) return false;
    mac = mac.toUpperCase();
    if (mac === "00:00:00:00:00:00") return false;
    const firstByte = parseInt(mac.split(":")[0], 16);
    return (firstByte & 0x02) === 0; // Not locally-administered
  };

  let lanIp = null;
  let wifiIp = null;

  for (const name of Object.keys(nets)) {
    const addrs = nets[name];

    if (isVirtual(name)) continue;

    for (const net of addrs) {
      if (net.family !== "IPv4") continue;

      // Keep loopback for fallback
      if (net.address === "127.0.0.1") continue;

      if (!isPhysicalMac(net.mac)) continue;

      // Ethernet interfaces
      if (/eth|enp|en\d|ethernet/i.test(name)) lanIp = net.address;

      // WiFi interfaces
      if (/wlan|wifi|wl/i.test(name)) wifiIp = net.address;
    }
  }

  // Priority: LAN > WiFi > loopback
  if (lanIp) return lanIp;
  if (wifiIp) return wifiIp;
  return "127.0.0.1";
}

// Example usage
//console.log("Primary IP:", getPrimaryIpAddress());

function runCommand(cmd) {
  try {
    return execSync(cmd, { stdio: ["pipe", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

// --- Virtual MAC detection helpers ---
function isVirtualMac(mac) {
  const virtualPrefixes = [
    "00:05:69",
    "00:0C:29",
    "00:50:56", // VMware
    "00:15:5D", // Hyper-V
    "08:00:27", // VirtualBox
    "02:42", // Docker
    "00:1C:42", // Parallels
    "52:54:00", // QEMU/KVM
  ];
  mac = mac.toUpperCase();
  return virtualPrefixes.some((prefix) => mac.startsWith(prefix));
}

function isLocallyAdministered(mac) {
  const firstByte = parseInt(mac.split(":")[0], 16);
  return (firstByte & 0x02) !== 0;
}

function filterPhysicalMacs(macs, interfaces, platform) {
  return macs.filter((mac) => {
    if (isVirtualMac(mac)) return false;
    if (isLocallyAdministered(mac)) return false;

    const ifaceName = Object.keys(interfaces).find((key) =>
      interfaces[key].some((i) => i.mac === mac)
    );

    // Platform-specific interface filtering
    if (platform === "darwin") {
      if (ifaceName && /lo0|awdl|bridge|utun|ppp|gif|stf/i.test(ifaceName))
        return false;
    } else if (platform === "linux") {
      if (ifaceName && /lo|docker|br-|veth|virbr|nat|virtual/i.test(ifaceName))
        return false;
    } else if (platform === "win32") {
      if (ifaceName && /virtual|vmware|hyper-v/i.test(ifaceName)) return false;
    }

    return true;
  });
}

// --- Platform-specific MAC address retrieval ---
function getWindowsMacAddresses() {
  const nets = os.networkInterfaces();
  let macs = [];
  Object.keys(nets).forEach((key) => {
    nets[key].forEach((net) => {
      if (
        net.mac &&
        net.mac !== "00:00:00:00:00:00" &&
        net.mac !== "ff:ff:ff:ff:ff:ff" &&
        !macs.includes(net.mac)
      ) {
        macs.push(net.mac);
      }
    });
  });
  return filterPhysicalMacs(macs, nets, "win32");
}

function getMacMacAddresses() {
  // Use networksetup (most reliable on macOS)
  const output = runCommand(
    "networksetup -listallhardwareports | grep -E 'Device|Ethernet Address'"
  );

  const lines = output.split("\n");

  let macs = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Ethernet Address")) {
      const mac = lines[i].split(":").slice(1).join(":").trim();
      if (
        mac &&
        mac !== "00:00:00:00:00:00" &&
        mac.match(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/)
      ) {
        macs.push(mac);
      }
    }
  }

  // Remove virtual & locally-administered
  macs = macs.filter(
    (mac) => !isVirtualMac(mac) && !isLocallyAdministered(mac)
  );

  return [...new Set(macs)];
}

function getLinuxMacAddresses() {
  const ipLinkOutput = runCommand("ip link | grep ether | awk '{print $2}'");
  let macs = ipLinkOutput
    .split("\n")
    .filter((mac) => mac && mac.match(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/))
    .map((mac) => mac.trim());

  // Fallback to /sys/class/net
  if (!macs.length) {
    const sysNetOutput = runCommand("cat /sys/class/net/*/address");
    macs = sysNetOutput
      .split("\n")
      .filter((mac) => mac && mac.match(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/))
      .map((mac) => mac.trim());
  }

  // Fallback to os.networkInterfaces if above methods fail
  if (!macs.length) {
    const nets = os.networkInterfaces();
    Object.keys(nets).forEach((key) => {
      nets[key].forEach((net) => {
        if (
          net.mac &&
          net.mac !== "00:00:00:00:00:00" &&
          net.mac !== "ff:ff:ff:ff:ff:ff" &&
          !macs.includes(net.mac)
        ) {
          macs.push(net.mac);
        }
      });
    });
  }

  return filterPhysicalMacs(
    [...new Set(macs)],
    os.networkInterfaces(),
    "linux"
  );
}

// --- Platform-specific system info ---
function getWindowsSystemInfo() {
  const serialNumber =
    runCommand("wmic bios get serialnumber").split("\n")[1]?.trim() ||
    runCommand(
      'powershell -Command "(Get-CimInstance Win32_BIOS).SerialNumber"'
    ) ||
    "Unavailable";

  const processorId =
    runCommand("wmic cpu get ProcessorId").split("\n")[1]?.trim() ||
    runCommand(
      'powershell -Command "(Get-CimInstance Win32_Processor).ProcessorId"'
    ) ||
    "Unavailable";

  const cpuModel =
    runCommand(
      'powershell -Command "(Get-CimInstance Win32_Processor).Name"'
    )?.trim() ||
    runCommand("wmic cpu get Name")?.split("\n")[1]?.trim() ||
    "Unavailable";

  const manufacturer =
    runCommand(
      'powershell -Command "(Get-CimInstance Win32_ComputerSystem).Manufacturer"'
    )?.trim() ||
    runCommand("wmic computersystem get manufacturer")
      ?.split("\n")[1]
      ?.trim() ||
    runCommand("wmic baseboard get manufacturer")?.split("\n")[1]?.trim() ||
    runCommand(
      'powershell -Command "(Get-CimInstance Win32_BaseBoard).Manufacturer"'
    )?.trim() ||
    "Unavailable";

  const model =
    runCommand(
      'powershell -Command "(Get-CimInstance Win32_ComputerSystem).Model"'
    )?.trim() ||
    runCommand("wmic computersystem get model")?.split("\n")[1]?.trim() ||
    runCommand("wmic baseboard get product")?.split("\n")[1]?.trim() ||
    runCommand(
      'powershell -Command "(Get-CimInstance Win32_BaseBoard).Product"'
    )?.trim() ||
    "Unavailable";

  const osVersion =
    runCommand("wmic os get Caption").split("\n")[1]?.trim() ||
    runCommand(
      'powershell -Command "(Get-CimInstance Win32_OperatingSystem).Caption"'
    ) ||
    runCommand('systeminfo | findstr /B /C:"OS Name"')?.split(":")[1]?.trim() ||
    `Windows_NT ${os.release()} (${os.arch()})`;

  return {
    serialNumber,
    processorId,
    cpuModel,
    manufacturer,
    model,
    osVersion,
    macAddresses: getWindowsMacAddresses(),
  };
}

function getLinuxSystemInfo() {
  const serialNumber =
    runCommand("cat /sys/class/dmi/id/product_serial") ||
    runCommand("sudo dmidecode -s system-serial-number") ||
    runCommand("dmidecode -s system-serial-number") ||
    "Unavailable";

  const processorId =
    runCommand(
      "cat /proc/cpuinfo | grep Serial | head -1 | awk '{print $3}'"
    ) ||
    runCommand("lscpu | grep 'Model name'") ||
    "Unavailable";

  const cpuModel =
    runCommand("lscpu | grep 'Model name' | awk -F: '{print $2}'")?.trim() ||
    runCommand(
      "cat /proc/cpuinfo | grep 'model name' | head -1 | awk -F: '{print $2}'"
    )?.trim() ||
    "Unavailable";

  const manufacturer =
    runCommand("cat /sys/class/dmi/id/sys_vendor") ||
    runCommand("sudo dmidecode -s system-manufacturer") ||
    runCommand("dmidecode -s system-manufacturer") ||
    runCommand("cat /sys/class/dmi/id/board_vendor") ||
    "Unavailable";

  const model =
    runCommand("cat /sys/class/dmi/id/product_name") ||
    runCommand("sudo dmidecode -s system-product-name") ||
    runCommand("dmidecode -s system-product-name") ||
    runCommand("cat /sys/class/dmi/id/board_name") ||
    "Unavailable";

  const osVersion =
    runCommand("lsb_release -d | cut -f2") ||
    runCommand("cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2")?.replace(
      /"/g,
      ""
    ) ||
    runCommand("uname -sr") ||
    `${os.type()} ${os.release()} (${os.arch()})`;

  return {
    serialNumber,
    processorId,
    cpuModel,
    manufacturer,
    model,
    osVersion,
    macAddresses: getLinuxMacAddresses(),
  };
}

// --- macOS system info ---
function getMacSystemInfo() {
  // --- MAC addresses ---
  const macOutput = runCommand(
    "networksetup -listallhardwareports | grep -E 'Device|Ethernet Address'"
  );

  const lines = macOutput.split("\n");

  // --- Processor ID (use hardware UUID) ---
  const processorId =
    runCommand(
      "ioreg -rd1 -c IOPlatformExpertDevice | awk -F\\\" '/IOPlatformUUID/ {print $4}'"
    ).trim() || "Unavailable";

  // --- CPU Model ---
  const cpuModel =
    runCommand("sysctl -n machdep.cpu.brand_string") || "Unavailable";

  // --- Serial Number ---
  const serialNumber =
    runCommand(
      "system_profiler SPHardwareDataType | awk '/Serial/ {print $4}'"
    ) || "Unavailable";

  // --- Manufacturer / Model ---
  const manufacturer = "Apple";

  const model =
    runCommand(
      "system_profiler SPHardwareDataType | awk -F': ' '/Model Name/ {print $2}'"
    ) || "Unavailable";

  // --- OS Version ---
  const osVersion =
    runCommand("sw_vers -productName") +
      " " +
      runCommand("sw_vers -productVersion") ||
    `${os.type()} ${os.release()} (${os.arch()})`;

  return {
    manufacturer,
    model,
    serialNumber,
    macAddresses: getMacMacAddresses(),
    processorId,
    cpuModel,
    osVersion,
  };
}

export function getSystemInfo() {
  let info = {
    manufacturer: "Unavailable",
    model: "Unavailable",
    serialNumber: "Unavailable",
    macAddresses: [],
    ramMB: Math.round(os.totalmem() / 1024 / 1024),
    operatingSystem: `${os.type()} ${os.release()} (${os.arch()})`,
    processorId: "Unavailable",
    cpuModel: "Unavailable",
  };

  if (process.platform === "win32") {
    info = { ...info, ...getWindowsSystemInfo() };
  } else if (process.platform === "linux") {
    info = { ...info, ...getLinuxSystemInfo() };
  } else if (process.platform === "darwin") {
    info = { ...info, ...getMacSystemInfo() };
  }

  info.operatingSystem = info.osVersion || info.operatingSystem;
  return info;
}

// --- Express setup ---
app.use(cors());

const info = getSystemInfo();
app.get("/system-info", (req, res) => {
  try {
    // const ipAddress = req.ip.replace("::ffff:", "");
    res.json({ ...info, ipAddress: getPrimaryIpAddress() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to retrieve system info" });
  }
});

app.listen(PORT, () => {
  // console.log(`Server listening on port ${PORT}`);
  console.log("System information loaded successfully");
});
