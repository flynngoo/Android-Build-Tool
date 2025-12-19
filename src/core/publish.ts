import fs from "fs";
import https from "https";
import http from "http";
import { URL } from "url";
import FormData from "form-data";
import kleur from "kleur";

/**
 * 发布平台类型
 */
export type PublishPlatform = "pgyer" | "fir";

/**
 * 发布配置
 */
export type PublishConfig = {
  platform: PublishPlatform;
  apiKey?: string; // pgyer 使用
  apiToken?: string; // fir 使用
  password?: string; // pgyer 可选密码
  updateDescription?: string; // 更新描述
  installType?: number; // pgyer 安装类型：1=公开，2=密码安装，3=邀请安装
};

/**
 * 发布结果
 */
export type PublishResult = {
  success: boolean;
  message: string;
  downloadUrl?: string;
  qrCodeUrl?: string;
  buildKey?: string;
  buildShortcutUrl?: string;
};

/**
 * 上传文件到蒲公英（Pgyer）
 */
async function uploadToPgyer(
  filePath: string,
  config: PublishConfig
): Promise<PublishResult> {
  if (!config.apiKey) {
    return {
      success: false,
      message: "蒲公英 API Key 未配置",
    };
  }

  return new Promise((resolve) => {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));
    form.append("_api_key", config.apiKey);

    if (config.password) {
      form.append("password", config.password);
    }

    if (config.updateDescription) {
      form.append("updateDescription", config.updateDescription);
    }

    if (config.installType) {
      form.append("installType", config.installType.toString());
    }

    const url = new URL("https://www.pgyer.com/apiv2/app/upload");
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: "POST",
      headers: form.getHeaders(),
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          if (result.code === 0) {
            resolve({
              success: true,
              message: "上传成功",
              downloadUrl: result.data.buildShortcutUrl
                ? `https://www.pgyer.com/${result.data.buildShortcutUrl}`
                : undefined,
              qrCodeUrl: result.data.buildQRCodeURL,
              buildKey: result.data.buildKey,
              buildShortcutUrl: result.data.buildShortcutUrl,
            });
          } else {
            resolve({
              success: false,
              message: `上传失败: ${result.message || "未知错误"}`,
            });
          }
        } catch (e) {
          resolve({
            success: false,
            message: `解析响应失败: ${(e as Error).message}`,
          });
        }
      });
    });

    req.on("error", (err) => {
      resolve({
        success: false,
        message: `请求失败: ${err.message}`,
      });
    });

    form.pipe(req);
  });
}

/**
 * 上传文件到 fir.im
 */
async function uploadToFir(filePath: string, config: PublishConfig): Promise<PublishResult> {
  if (!config.apiToken) {
    return {
      success: false,
      message: "fir.im API Token 未配置",
    };
  }

  // fir.im 需要两步：1. 获取上传凭证 2. 上传文件
  try {
    // 第一步：获取上传凭证
    const certUrl = new URL("https://api.fir.im/apps");
    const certOptions = {
      hostname: certUrl.hostname,
      port: certUrl.port || 443,
      path: certUrl.pathname,
      method: "GET",
      headers: {
        "X-Token": config.apiToken,
      },
    };

    const certResult = await new Promise<{ cert: any; key: string }>((resolve, reject) => {
      const req = https.request(certOptions, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const result = JSON.parse(data);
            if (result.cert && result.cert.binary) {
              resolve({
                cert: result.cert.binary,
                key: result.cert.key,
              });
            } else {
              reject(new Error(result.message || "获取上传凭证失败"));
            }
          } catch (e) {
            reject(new Error(`解析凭证响应失败: ${(e as Error).message}`));
          }
        });
      });

      req.on("error", reject);
      req.end();
    });

    // 第二步：上传文件
    const form = new FormData();
    form.append("key", certResult.key);
    form.append("token", certResult.cert.token);
    form.append("file", fs.createReadStream(filePath));

    if (config.updateDescription) {
      form.append("changelog", config.updateDescription);
    }

    const uploadUrl = new URL(certResult.cert.upload_url);
    const uploadOptions = {
      hostname: uploadUrl.hostname,
      port: uploadUrl.port || 443,
      path: uploadUrl.pathname,
      method: "POST",
      headers: form.getHeaders(),
    };

    return new Promise((resolve) => {
      const req = https.request(uploadOptions, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const result = JSON.parse(data);
            if (result.is_completed) {
              resolve({
                success: true,
                message: "上传成功",
                downloadUrl: result.download_url,
                qrCodeUrl: result.qrcode_url,
              });
            } else {
              resolve({
                success: false,
                message: `上传失败: ${result.message || "未知错误"}`,
              });
            }
          } catch (e) {
            resolve({
              success: false,
              message: `解析响应失败: ${(e as Error).message}`,
            });
          }
        });
      });

      req.on("error", (err) => {
        resolve({
          success: false,
          message: `上传请求失败: ${err.message}`,
        });
      });

      form.pipe(req);
    });
  } catch (err) {
    return {
      success: false,
      message: `获取上传凭证失败: ${(err as Error).message}`,
    };
  }
}

/**
 * 发布 APK 到指定平台
 */
export async function publishApk(
  filePath: string,
  config: PublishConfig
): Promise<PublishResult> {
  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      message: `文件不存在: ${filePath}`,
    };
  }

  // 检查文件扩展名
  if (!filePath.endsWith(".apk") && !filePath.endsWith(".aab")) {
    return {
      success: false,
      message: `不支持的文件类型，仅支持 .apk 或 .aab 文件`,
    };
  }

  console.log(kleur.cyan(`\n开始上传到 ${config.platform === "pgyer" ? "蒲公英" : "fir.im"}...`));
  console.log(kleur.gray(`文件: ${filePath}`));

  try {
    let result: PublishResult;
    if (config.platform === "pgyer") {
      result = await uploadToPgyer(filePath, config);
    } else {
      result = await uploadToFir(filePath, config);
    }

    if (result.success) {
      console.log(kleur.green(`✅ ${result.message}`));
      if (result.downloadUrl) {
        console.log(kleur.cyan(`下载链接: ${result.downloadUrl}`));
      }
      if (result.qrCodeUrl) {
        console.log(kleur.cyan(`二维码: ${result.qrCodeUrl}`));
      }
    } else {
      console.log(kleur.red(`❌ ${result.message}`));
    }

    return result;
  } catch (err) {
    const errorMsg = `发布失败: ${(err as Error).message}`;
    console.log(kleur.red(`❌ ${errorMsg}`));
    return {
      success: false,
      message: errorMsg,
    };
  }
}

/**
 * 批量发布多个 APK 文件
 */
export async function publishMultipleApks(
  filePaths: string[],
  config: PublishConfig
): Promise<PublishResult[]> {
  const results: PublishResult[] = [];
  for (const filePath of filePaths) {
    const result = await publishApk(filePath, config);
    results.push(result);
    // 如果失败，可以选择是否继续
    if (!result.success) {
      console.log(kleur.yellow(`跳过剩余文件上传`));
      break;
    }
  }
  return results;
}

