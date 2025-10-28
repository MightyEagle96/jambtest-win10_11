// import os from "os";
// import { execSync } from "child_process";
// import express from "express";
// import cors from "cors";

// const app = express();
// const PORT = 4001;

// function runCommand(cmd) {
//   try {
//     return execSync(cmd, { stdio: ["pipe", "pipe", "ignore"] })
//       .toString()
//       .trim();
//   } catch {
//     return "";
//   }
// }

// // --- Virtual MAC detection helpers ---
// function isVirtualMac(mac) {
//   const virtualPrefixes = [
//     "00:05:69",
//     "00:0C:29",
//     "00:50:56", // VMware
//     "00:15:5D", // Hyper-V
//     "08:00:27", // VirtualBox
//     "02:42", // Docker
//     "00:1C:42", // Parallels
//     "52:54:00", // QEMU/KVM
//   ];
//   mac = mac.toUpperCase();
//   return virtualPrefixes.some((prefix) => mac.startsWith(prefix));
// }

// function isLocallyAdministered(mac) {
//   const firstByte = parseInt(mac.split(":")[0], 16);
//   return (firstByte & 0x02) !== 0;
// }

// function filterPhysicalMacs(macs, interfaces) {
//   return macs.filter((mac) => {
//     if (isVirtualMac(mac)) return false;
//     if (isLocallyAdministered(mac)) return false;

//     const ifaceName = Object.keys(interfaces).find((key) =>
//       interfaces[key].some((i) => i.mac === mac)
//     );

//     if (
//       ifaceName &&
//       /veth|docker|br-|nat|virtual|vmware|hyper-v/i.test(ifaceName)
//     )
//       return false;

//     return true;
//   });
// }

// // --- Platform-specific helpers ---
// function getWindowsSystemInfo() {
//   let serialNumber = "";
//   let manufacturer = "";
//   let model = "";

//   // Serial Number
//   serialNumber =
//     runCommand("wmic bios get serialnumber").split("\n")[1]?.trim() ||
//     runCommand(
//       'powershell -Command "(Get-CimInstance Win32_BIOS).SerialNumber"'
//     ) ||
//     "Unavailable";

//   // Processor ID
//   const processorId =
//     runCommand("wmic cpu get ProcessorId").split("\n")[1]?.trim() ||
//     runCommand(
//       'powershell -Command "(Get-CimInstance Win32_Processor).ProcessorId"'
//     ) ||
//     "Unavailable";

//   // CPU Model
//   const cpuModel =
//     runCommand(
//       'powershell -Command "(Get-CimInstance Win32_Processor).Name"'
//     )?.trim() ||
//     runCommand("wmic cpu get Name")?.split("\n")[1]?.trim() ||
//     "Unavailable";

//   // Manufacturer
//   manufacturer =
//     runCommand(
//       'powershell -Command "(Get-CimInstance Win32_ComputerSystem).Manufacturer"'
//     )?.trim() ||
//     runCommand("wmic computersystem get manufacturer")
//       ?.split("\n")[1]
//       ?.trim() ||
//     runCommand("wmic baseboard get manufacturer")?.split("\n")[1]?.trim() ||
//     runCommand(
//       'powershell -Command "(Get-CimInstance Win32_BaseBoard).Manufacturer"'
//     )?.trim() ||
//     "Unavailable";

//   // Model
//   model =
//     runCommand(
//       'powershell -Command "(Get-CimInstance Win32_ComputerSystem).Model"'
//     )?.trim() ||
//     runCommand("wmic computersystem get model")?.split("\n")[1]?.trim() ||
//     runCommand("wmic baseboard get product")?.split("\n")[1]?.trim() ||
//     runCommand(
//       'powershell -Command "(Get-CimInstance Win32_BaseBoard).Product"'
//     )?.trim() ||
//     "Unavailable";

//   // OS Version
//   const osVersion =
//     runCommand("wmic os get Caption").split("\n")[1]?.trim() ||
//     runCommand(
//       'powershell -Command "(Get-CimInstance Win32_OperatingSystem).Caption"'
//     ) ||
//     runCommand('systeminfo | findstr /B /C:"OS Name"')?.split(":")[1]?.trim() ||
//     `Windows_NT ${os.release()} (${os.arch()})`;

//   return {
//     serialNumber,
//     processorId,
//     cpuModel,
//     manufacturer,
//     model,
//     osVersion,
//   };
// }

// function getLinuxSystemInfo() {
//   // Serial Number
//   const serialNumber =
//     runCommand("cat /sys/class/dmi/id/product_serial") ||
//     runCommand("sudo dmidecode -s system-serial-number") ||
//     runCommand("dmidecode -s system-serial-number") ||
//     "Unavailable";

//   // Processor ID
//   const processorId =
//     runCommand(
//       "cat /proc/cpuinfo | grep Serial | head -1 | awk '{print $3}'"
//     ) ||
//     runCommand("lscpu | grep 'Model name'") ||
//     "Unavailable";

//   // CPU Model
//   const cpuModel =
//     runCommand("lscpu | grep 'Model name' | awk -F: '{print $2}'")?.trim() ||
//     runCommand(
//       "cat /proc/cpuinfo | grep 'model name' | head -1 | awk -F: '{print $2}'"
//     )?.trim() ||
//     "Unavailable";

//   // Manufacturer
//   const manufacturer =
//     runCommand("cat /sys/class/dmi/id/sys_vendor") ||
//     runCommand("sudo dmidecode -s system-manufacturer") ||
//     runCommand("dmidecode -s system-manufacturer") ||
//     runCommand("cat /sys/class/dmi/id/board_vendor") ||
//     "Unavailable";

//   // Model
//   const model =
//     runCommand("cat /sys/class/dmi/id/product_name") ||
//     runCommand("sudo dmidecode -s system-product-name") ||
//     runCommand("dmidecode -s system-product-name") ||
//     runCommand("cat /sys/class/dmi/id/board_name") ||
//     "Unavailable";

//   // OS Version
//   const osVersion =
//     runCommand("lsb_release -d | cut -f2") ||
//     runCommand("cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2")?.replace(
//       /"/g,
//       ""
//     ) ||
//     runCommand("uname -sr") ||
//     `${os.type()} ${os.release()} (${os.arch()})`;

//   return {
//     serialNumber,
//     processorId,
//     cpuModel,
//     manufacturer,
//     model,
//     osVersion,
//   };
// }

// function getMacSystemInfo() {
//   // Serial Number
//   const serialNumber =
//     runCommand(
//       "system_profiler SPHardwareDataType | awk '/Serial/ {print $4}'"
//     ) ||
//     runCommand(
//       "ioreg -l | grep IOPlatformSerialNumber | awk -F '\"' '{print $4}'"
//     ) ||
//     "Unavailable";

//   // Processor ID
//   const processorId =
//     runCommand("ioreg -l | grep IOPlatformUUID | awk -F '\"' '{print $4}'") ||
//     "Unavailable";

//   // CPU Model
//   const cpuModel =
//     runCommand("sysctl -n machdep.cpu.brand_string") || "Unavailable";

//   // Manufacturer
//   const manufacturer = "Apple";

//   // Model
//   const model =
//     runCommand(
//       "system_profiler SPHardwareDataType | awk -F': ' '/Model Name/ {print $2}'"
//     ) ||
//     runCommand(
//       "system_profiler SPHardwareDataType | awk -F': ' '/Model Identifier/ {print $2}'"
//     ) ||
//     "Unavailable";

//   // OS Version
//   const osVersion =
//     runCommand("sw_vers -productName") +
//       " " +
//       runCommand("sw_vers -productVersion") ||
//     `${os.type()} ${os.release()} (${os.arch()})`;

//   return {
//     serialNumber,
//     processorId,
//     cpuModel,
//     manufacturer,
//     model,
//     osVersion,
//   };
// }

// // --- Universal info collector ---
// export function getSystemInfo() {
//   let info = {
//     manufacturer: "Unavailable",
//     model: "Unavailable",
//     serialNumber: "Unavailable",
//     macAddresses: [],
//     ramMB: Math.round(os.totalmem() / 1024 / 1024),
//     operatingSystem: `${os.type()} ${os.release()} (${os.arch()})`,
//     processorId: "Unavailable",
//     cpuModel: "Unavailable",
//   };

//   if (process.platform === "win32")
//     info = { ...info, ...getWindowsSystemInfo() };
//   else if (process.platform === "linux")
//     info = { ...info, ...getLinuxSystemInfo() };
//   else if (process.platform === "darwin")
//     info = { ...info, ...getMacSystemInfo() };

//   const nets = os.networkInterfaces();
//   let macs = [];
//   Object.keys(nets).forEach((key) => {
//     nets[key].forEach((net) => {
//       if (
//         net.mac &&
//         net.mac !== "00:00:00:00:00:00" &&
//         net.mac !== "ff:ff:ff:ff:ff:ff"
//       ) {
//         if (!macs.includes(net.mac)) macs.push(net.mac);
//       }
//     });
//   });

//   info.macAddresses = filterPhysicalMacs(macs, nets);
//   info.operatingSystem = info.osVersion || info.operatingSystem;

//   return info;
// }

// // --- Express setup ---
// app.use(cors());

// const info = getSystemInfo();
// app.get("/system-info", (req, res) => {
//   try {
//     res.json(info);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to retrieve system info" });
//   }
// });

// app.listen(PORT, () => {
//   console.log(`Server listening on port ${PORT}`);
// });

import os from "os";
import { execSync } from "child_process";
import express from "express";
import cors from "cors";

const app = express();
const PORT = 4001;

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
  const ifconfigOutput = runCommand("ifconfig | grep ether | awk '{print $2}'");
  let macs = ifconfigOutput
    .split("\n")
    .filter((mac) => mac && mac.match(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/))
    .map((mac) => mac.trim());

  // Fallback to os.networkInterfaces if ifconfig fails
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
    "darwin"
  );
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

function getMacSystemInfo() {
  const serialNumber =
    runCommand(
      "system_profiler SPHardwareDataType | awk '/Serial/ {print $4}'"
    ) ||
    runCommand(
      "ioreg -l | grep IOPlatformSerialNumber | awk -F '\"' '{print $4}'"
    ) ||
    "Unavailable";

  const processorId =
    runCommand("ioreg -l | grep IOPlatformUUID | awk -F '\"' '{print $4}'") ||
    "Unavailable";

  const cpuModel =
    runCommand("sysctl -n machdep.cpu.brand_string") || "Unavailable";

  const manufacturer = "Apple";

  const model =
    runCommand(
      "system_profiler SPHardwareDataType | awk -F': ' '/Model Name/ {print $2}'"
    ) ||
    runCommand(
      "system_profiler SPHardwareDataType | awk -F': ' '/Model Identifier/ {print $2}'"
    ) ||
    "Unavailable";

  const osVersion =
    runCommand("sw_vers -productName") +
      " " +
      runCommand("sw_vers -productVersion") ||
    `${os.type()} ${os.release()} (${os.arch()})`;

  return {
    serialNumber,
    processorId,
    cpuModel,
    manufacturer,
    model,
    osVersion,
    macAddresses: getMacMacAddresses(),
  };
}

// --- Universal info collector ---
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
    res.json(info);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to retrieve system info" });
  }
});

app.listen(PORT, () => {
  // console.log(`Server listening on port ${PORT}`);
  console.log("System information loaded successfully");
});
