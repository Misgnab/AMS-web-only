import { execSync, spawn } from "child_process";
import fs from "fs";

/**
 * Ensures the MySQL / MariaDB daemon is running in the container environment
 * and configured for local TCP access.
 */
export function ensureMysqlRunning(): void {
  // If user configured custom credentials or external MySQL, skip local daemon management
  if (process.env.MYSQL_USER && process.env.MYSQL_USER !== "root") {
    return;
  }
  if (process.env.MYSQL_PASSWORD && process.env.MYSQL_PASSWORD.length > 0) {
    return;
  }
  if (process.env.MYSQL_HOST && !["127.0.0.1", "localhost"].includes(process.env.MYSQL_HOST)) {
    return;
  }
  // In non-root shared hosting or cPanel environments, skip system daemon provisioning
  if (typeof process.getuid === "function" && process.getuid() !== 0) {
    return;
  }

  const hasMysqlBinaries = 
    fs.existsSync("/usr/sbin/mariadbd") ||
    fs.existsSync("/usr/sbin/mysqld") ||
    fs.existsSync("/usr/bin/mariadbd") ||
    fs.existsSync("/usr/bin/mysqld") ||
    fs.existsSync("/etc/init.d/mariadb") ||
    fs.existsSync("/etc/init.d/mysql");

  if (!hasMysqlBinaries) {
    return;
  }

  try {
    // 1. Test if MySQL is already responding to ping
    let isAlive = false;
    try {
      execSync("mariadb-admin --defaults-file=/etc/mysql/debian.cnf ping 2>/dev/null || mariadb-admin -u root ping 2>/dev/null || mysqladmin -u root ping 2>/dev/null", { stdio: "pipe", timeout: 2000 });
      isAlive = true;
    } catch (_) {
      isAlive = false;
    }

    if (!isAlive) {
      // 2. Ensure /run/mysqld exists with proper permissions
      if (!fs.existsSync("/run/mysqld")) {
        try {
          fs.mkdirSync("/run/mysqld", { recursive: true });
        } catch (_) {}
      }
      try {
        execSync("chown -R mysql:mysql /run/mysqld /var/lib/mysql 2>/dev/null || true", { stdio: "ignore" });
        execSync("chmod 777 /run/mysqld 2>/dev/null || true", { stdio: "ignore" });
        if (fs.existsSync("/run/mysqld/mysqld.sock")) {
          try { fs.unlinkSync("/run/mysqld/mysqld.sock"); } catch (_) {}
        }
      } catch (_) {}

      // 3. Ensure datadir is initialized
      if (!fs.existsSync("/var/lib/mysql/mysql")) {
        try {
          execSync("mariadb-install-db --user=mysql --datadir=/var/lib/mysql 2>/dev/null || mysql_install_db --user=mysql --datadir=/var/lib/mysql 2>/dev/null", { stdio: "ignore" });
        } catch (_) {}
      }

      // 4. Try init service script first (cleanest daemon startup on Linux/Debian)
      try {
        execSync("service mariadb start 2>/dev/null || /etc/init.d/mariadb start 2>/dev/null || service mysql start 2>/dev/null || /etc/init.d/mysql start 2>/dev/null", { stdio: "ignore", timeout: 15000 });
      } catch (_) {}

      // Check if service start succeeded
      try {
        execSync("mariadb-admin -u root ping 2>/dev/null || mysqladmin -u root ping 2>/dev/null", { stdio: "pipe", timeout: 2000 });
        isAlive = true;
      } catch (_) {
        isAlive = false;
      }

      // 5. Fallback: Locate or install mysqld/mariadbd and spawn directly if service script was unavailable
      if (!isAlive) {
        let daemonBin = fs.existsSync("/usr/sbin/mariadbd") 
          ? "/usr/sbin/mariadbd" 
          : fs.existsSync("/usr/sbin/mysqld") 
          ? "/usr/sbin/mysqld" 
          : fs.existsSync("/usr/bin/mariadbd")
          ? "/usr/bin/mariadbd"
          : fs.existsSync("/usr/bin/mysqld")
          ? "/usr/bin/mysqld"
          : null;

        if (!daemonBin) {
          // In containers or environments without preinstalled mariadb, do not stall on apt-get
          return;
        }

        if (daemonBin) {
          const child = spawn(daemonBin, [
            "--user=mysql",
            "--datadir=/var/lib/mysql",
            "--bind-address=0.0.0.0",
            "--port=3306",
            "--skip-networking=0",
            "--socket=/run/mysqld/mysqld.sock"
          ], {
            detached: true,
            stdio: "ignore"
          });
          child.unref();

          // Wait up to 10 seconds for daemon to start responding
          for (let i = 0; i < 20; i++) {
            try {
              execSync("sleep 0.5 && (mariadb-admin -u root ping 2>/dev/null || mysqladmin -u root ping 2>/dev/null)", { stdio: "pipe", timeout: 1500 });
              console.log("[MySQL Daemon] Local MySQL service started successfully.");
              isAlive = true;
              break;
            } catch (_) {}
          }
        }
      }
    }

    // 6. Ensure database exists and root has full TCP access from localhost and 127.0.0.1
    if (isAlive) {
      const sqlCommands = `
        CREATE DATABASE IF NOT EXISTS \\\`buildtrack_ams\\\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

        CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED BY '';
        ALTER USER 'root'@'127.0.0.1' IDENTIFIED BY '';
        GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION;

        CREATE USER IF NOT EXISTS 'root'@'localhost' IDENTIFIED BY '';
        ALTER USER 'root'@'localhost' IDENTIFIED BY '';
        GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost' WITH GRANT OPTION;

        CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY '';
        ALTER USER 'root'@'%' IDENTIFIED BY '';
        GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;

        FLUSH PRIVILEGES;
      `;
      try {
        execSync(`(test -f /etc/mysql/debian.cnf && mariadb --defaults-file=/etc/mysql/debian.cnf -e "${sqlCommands}") 2>/dev/null || (test -S /run/mysqld/mysqld.sock && mariadb --socket=/run/mysqld/mysqld.sock -u root -e "${sqlCommands}") 2>/dev/null || mariadb -u root -e "${sqlCommands}" 2>/dev/null || mysql -u root -e "${sqlCommands}" 2>/dev/null`, { stdio: "ignore", timeout: 8000 });
      } catch (userErr: any) {
        console.warn("[MySQL Daemon] Privilege provisioning notice:", userErr.message);
      }
    }
  } catch (err: any) {
    console.warn("[MySQL Daemon] Startup notice:", err.message);
  }
}
