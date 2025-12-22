use serde::{Deserialize, Serialize};
use tauri::Manager;
use std::{
  fs,
  path::{Path, PathBuf},
  process::Command as StdCommand,
};
use tokio::process::Command;
use reqwest::multipart::{Form, Part};

#[derive(Serialize)]
struct EnvCheck {
  tool: String,
  ok: bool,
  message: String,
  detail: Option<String>,
}

fn run_command(cmd: &str, args: &[&str]) -> (bool, String) {
  match StdCommand::new(cmd).args(args).output() {
    Ok(out) => {
      let mut data = Vec::new();
      data.extend(out.stdout);
      data.extend(out.stderr);
      (out.status.success(), String::from_utf8_lossy(&data).trim().to_string())
    }
    Err(err) => (false, err.to_string()),
  }
}

fn check_java() -> EnvCheck {
  let (ok, out) = run_command("java", &["-version"]);
  EnvCheck {
    tool: "Java (JDK)".into(),
    ok,
    message: if ok { "已检测到 JDK" } else { "未检测到 JDK，请安装 JDK 17+" }.into(),
    detail: Some(out),
  }
}

fn check_java_home() -> EnvCheck {
  let (ok, out) = run_command("/usr/libexec/java_home", &[]);
  EnvCheck {
    tool: "JAVA_HOME".into(),
    ok,
    message: if ok { format!("JAVA_HOME: {out}") } else { "未检测到 JAVA_HOME".into() },
    detail: Some(out),
  }
}

fn check_xcode() -> EnvCheck {
  let (ok, out) = run_command("xcode-select", &["-p"]);
  EnvCheck {
    tool: "Xcode CLT".into(),
    ok,
    message: if ok {
      format!("已检测到 Xcode Command Line Tools: {out}")
    } else {
      "未检测到 Xcode CLT".into()
    },
    detail: Some(out),
  }
}

#[tauri::command]
fn check_env() -> Vec<EnvCheck> {
  vec![
    check_java(),
    check_java_home(),
    check_xcode(),
  ]
}

#[derive(Serialize, Deserialize, Clone)]
struct Project {
  name: String,
  path: String,
  #[serde(rename = "defaultModule")]
  default_module: Option<String>,
  #[serde(rename = "modules")]
  modules: Option<Vec<String>>,
  #[serde(rename = "defaultVariant")]
  default_variant: Option<String>,
  #[serde(rename = "variants")]
  variants: Option<Vec<String>>,
  #[serde(rename = "buildType")]
  build_type: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct ProjectsConfig {
  projects: Vec<Project>,
}

fn config_path(app_handle: &tauri::AppHandle) -> PathBuf {
  let cwd = std::env::current_dir().unwrap_or_default();
  let candidates = [
    cwd.join("config/projects.json"),
    cwd.join("../config/projects.json"),
  ];
  for c in candidates {
    if c.exists() {
      return c;
    }
  }

  if let Ok(dir) = app_handle.path().app_config_dir() {
    return dir.join("projects.json");
  }

  std::env::temp_dir().join("projects.json")
}

fn ensure_config(app_handle: &tauri::AppHandle) -> PathBuf {
  let path = config_path(app_handle);
  if let Some(parent) = path.parent() {
    let _ = fs::create_dir_all(parent);
  }
  if !path.exists() {
    let default = ProjectsConfig { projects: vec![] };
    let _ = fs::write(&path, serde_json::to_string_pretty(&default).unwrap_or_else(|_| "{}".into()));
  }
  path
}

#[tauri::command]
fn list_projects(app_handle: tauri::AppHandle) -> Result<ProjectsConfig, String> {
  let path = ensure_config(&app_handle);
  let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
  let cfg: ProjectsConfig = serde_json::from_str(&content).map_err(|e| e.to_string())?;
  Ok(cfg)
}

#[tauri::command]
fn add_project(app_handle: tauri::AppHandle, project: Project) -> Result<(), String> {
  let path = ensure_config(&app_handle);
  let mut cfg = list_projects(app_handle.clone())?;
  if cfg.projects.iter().any(|p| p.name == project.name) {
    return Err(format!("工程名已存在：{}", project.name));
  }
  let gradle_name = if cfg!(windows) { "gradlew.bat" } else { "gradlew" };
  let gradle_path = Path::new(&project.path).join(gradle_name);
  if !gradle_path.exists() {
    return Err("未找到 gradlew，请确认工程路径正确".into());
  }
  cfg.projects.push(project);
  fs::write(path, serde_json::to_string_pretty(&cfg).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_project(app_handle: tauri::AppHandle, name: String, project: Project) -> Result<(), String> {
  let path = ensure_config(&app_handle);
  let mut cfg = list_projects(app_handle.clone())?;
  let index = cfg.projects.iter().position(|p| p.name == name);
  match index {
    Some(idx) => {
      let existing_project = &cfg.projects[idx];
      
      // 如果更新了路径，需要验证 gradlew 是否存在
      if project.path != existing_project.path {
        let gradle_name = if cfg!(windows) { "gradlew.bat" } else { "gradlew" };
        let gradle_path = Path::new(&project.path).join(gradle_name);
        if !gradle_path.exists() {
          return Err("未找到 gradlew，请确认工程路径正确".into());
        }
      }
      
      // 更新工程信息（保留原有字段，用新值覆盖）
      cfg.projects[idx] = project;
      fs::write(path, serde_json::to_string_pretty(&cfg).unwrap()).map_err(|e| e.to_string())
    }
    None => Err(format!("工程不存在：{}", name)),
  }
}

#[tauri::command]
fn delete_project(app_handle: tauri::AppHandle, name: String) -> Result<(), String> {
  let path = ensure_config(&app_handle);
  let mut cfg = list_projects(app_handle.clone())?;
  let index = cfg.projects.iter().position(|p| p.name == name);
  match index {
    Some(idx) => {
      cfg.projects.remove(idx);
      fs::write(path, serde_json::to_string_pretty(&cfg).unwrap()).map_err(|e| e.to_string())
    }
    None => Err(format!("工程不存在：{}", name)),
  }
}

#[derive(Serialize)]
struct BuildResult {
  code: i32,
  output: String,
}

#[tauri::command]
async fn build_project(
  app_handle: tauri::AppHandle,
  name: String,
  module: Option<String>,
  variant: Option<String>,
  build_type: Option<String>,
  output_dir: Option<String>,
) -> Result<BuildResult, String> {
  let cfg = list_projects(app_handle.clone())?;
  let project = cfg.projects.iter().find(|p| p.name == name).ok_or("未找到工程")?;
  
  // 获取构建参数，优先使用传入的值，否则使用工程默认值
  let variant = variant.or_else(|| {
    // 如果有 variants 数组，使用第一个
    project.variants.as_ref()
      .and_then(|v| v.first())
      .map(|s| s.clone())
      .or_else(|| project.default_variant.clone())
  });
  let build_type = build_type.or_else(|| project.build_type.clone()).unwrap_or_else(|| "Debug".into());
  let module = module.or_else(|| {
    // 如果有 modules 数组，使用第一个
    project.modules.as_ref()
      .and_then(|m| m.first())
      .map(|s| s.clone())
      .or_else(|| project.default_module.clone())
  });
  
  // variant规则：variant + buildType（不需要大小写转换，以填写为准）
  let full_variant = match &variant {
    Some(v) => format!("{}{}", v, build_type),
    None => build_type.clone(),
  };
  
  // 输出目录：优先使用传入的 output_dir，否则使用 path+module+variant/buildType
  let output_dir = if let Some(ref custom_dir) = output_dir {
    Path::new(custom_dir).to_path_buf()
  } else {
    let mut dir = Path::new(&project.path).to_path_buf();
    if let Some(m) = &module {
      dir = dir.join(m);
    }
    // 使用 variant/buildType 格式，而不是 variant+buildType
    match &variant {
      Some(v) => {
        dir = dir.join(v);
        dir = dir.join(&build_type);
      }
      None => {
        dir = dir.join(&build_type);
      }
    }
    dir
  };
  
  // 构建gradle任务名称
  let task = match &module {
    Some(m) => format!(":{}:assemble{}", m, full_variant),
    None => format!("assemble{}", full_variant),
  };
  
  let gradle_name = if cfg!(windows) { "gradlew.bat" } else { "gradlew" };
  let gradle_path = Path::new(&project.path).join(gradle_name);
  if !gradle_path.exists() {
    return Err("未找到 gradlew，请确认工程路径正确".into());
  }
  
  // 使用异步 Command 执行构建命令，避免阻塞主线程
  let output = Command::new(&gradle_path)
    .arg(&task)
    .current_dir(&project.path)
    .output()
    .await
    .map_err(|e| format!("执行构建命令失败: {}", e))?;

  let mut combined = Vec::new();
  combined.extend(output.stdout);
  combined.extend(output.stderr);
  let code = output.status.code().unwrap_or(-1);
  
  let mut output_text = String::from_utf8_lossy(&combined).to_string();
  
  // 如果构建成功，复制构建产物到输出目录
  if code == 0 {
    let output_dir_str = output_dir.to_string_lossy().to_string();
    output_text.push_str(&format!("\n\n输出目录: {}\n", output_dir_str));
    
    // 查找并复制构建产物
    let module_path = match &module {
      Some(m) => Path::new(&project.path).join(m),
      None => Path::new(&project.path).to_path_buf(),
    };
    
    output_text.push_str(&format!("查找路径: {}\n", module_path.to_string_lossy()));
    let artifacts = find_build_artifacts(&module_path);
    output_text.push_str(&format!("找到 {} 个构建产物\n", artifacts.len()));
    
    if !artifacts.is_empty() {
      for artifact in &artifacts {
        output_text.push_str(&format!("  - {}\n", artifact.to_string_lossy()));
      }
      
      // 如果输出目录已存在，先清理目录（确保只保留最新的构建产物）
      if output_dir.exists() {
        output_text.push_str(&format!("清理输出目录: {}\n", output_dir.to_string_lossy()));
        clean_directory(&output_dir, &mut output_text);
      }
      
      // 确保输出目录存在
      if let Err(e) = fs::create_dir_all(&output_dir) {
        output_text.push_str(&format!("创建输出目录失败: {}\n", e));
      } else {
        for artifact in &artifacts {
          if let Some(file_name) = artifact.file_name() {
            let dest = output_dir.join(file_name);
            if !artifact.exists() {
              output_text.push_str(&format!("❌ 源文件不存在: {}\n", artifact.to_string_lossy()));
              continue;
            }
            if let Err(e) = fs::copy(artifact, &dest) {
              output_text.push_str(&format!("❌ 复制失败 {}: {}\n", file_name.to_string_lossy(), e));
            } else {
              output_text.push_str(&format!("✅ 已复制: {} -> {}\n", file_name.to_string_lossy(), dest.to_string_lossy()));
            }
          }
        }
      }
    } else {
      output_text.push_str("未找到构建产物，请检查构建是否成功\n");
    }
  } else {
    // 构建失败时也显示输出目录信息
    let output_dir_str = output_dir.to_string_lossy().to_string();
    output_text = format!("输出目录: {}\n\n{}", output_dir_str, output_text);
  }

  Ok(BuildResult {
    code,
    output: output_text,
  })
}

/// 清理目录中的所有文件和子目录
fn clean_directory(dir: &Path, output_text: &mut String) {
  if !dir.exists() {
    return;
  }
  
  if let Ok(entries) = fs::read_dir(dir) {
    for entry in entries.flatten() {
      let path = entry.path();
      let result = if path.is_dir() {
        fs::remove_dir_all(&path)
      } else {
        fs::remove_file(&path)
      };
      
      if let Err(e) = result {
        output_text.push_str(&format!("⚠️ 清理文件/目录失败: {}: {}\n", path.to_string_lossy(), e));
      }
    }
  }
}

/// 查找构建产物（APK/AAB）
fn find_build_artifacts(module_path: &Path) -> Vec<PathBuf> {
  let mut artifacts = Vec::new();
  
  // APK 文件路径
  let apk_path = module_path.join("build/outputs/apk");
  // AAB 文件路径
  let bundle_path = module_path.join("build/outputs/bundle");
  
  // 查找所有 APK 文件
  if apk_path.exists() {
    find_artifacts_recursive(&apk_path, "apk", &mut artifacts);
  }
  
  // 查找所有 AAB 文件
  if bundle_path.exists() {
    find_artifacts_recursive(&bundle_path, "aab", &mut artifacts);
  }
  
  artifacts
}

/// 递归查找构建产物
fn find_artifacts_recursive(dir: &Path, extension: &str, artifacts: &mut Vec<PathBuf>) {
  if let Ok(entries) = fs::read_dir(dir) {
    for entry in entries.flatten() {
      let path = entry.path();
      if path.is_dir() {
        find_artifacts_recursive(&path, extension, artifacts);
      } else if path.extension().and_then(|s| s.to_str()) == Some(extension) {
        artifacts.push(path);
      }
    }
  }
}

#[derive(Serialize, Deserialize, Clone)]
struct PublishConfig {
  platform: String, // "pgyer" 或 "fir"
  api_key: Option<String>, // pgyer 使用
  api_token: Option<String>, // fir 使用
  password: Option<String>, // pgyer 可选密码
  update_description: Option<String>, // 更新描述
  go_fir_cli_path: Option<String>, // fir 平台专用：go-fir-cli 安装路径
}

#[derive(Serialize, Deserialize, Clone)]
struct PublishPlatformConfig {
  name: String, // 配置名称
  platform: String, // "pgyer" 或 "fir"
  api_key: Option<String>, // pgyer 使用
  api_token: Option<String>, // fir 使用
  password: Option<String>, // pgyer 可选密码
  default_description: Option<String>, // 默认更新描述
  go_fir_cli_path: Option<String>, // fir 平台专用：go-fir-cli 安装路径
}

#[derive(Serialize, Deserialize)]
struct PublishPlatformsConfig {
  platforms: Vec<PublishPlatformConfig>,
}

fn publish_config_path(app_handle: &tauri::AppHandle) -> PathBuf {
  let cwd = std::env::current_dir().unwrap_or_default();
  let candidates = [
    cwd.join("config/publish_platforms.json"),
    cwd.join("../config/publish_platforms.json"),
  ];
  for c in candidates {
    if c.exists() {
      return c;
    }
  }

  if let Ok(dir) = app_handle.path().app_config_dir() {
    return dir.join("publish_platforms.json");
  }

  std::env::temp_dir().join("publish_platforms.json")
}

fn ensure_publish_config(app_handle: &tauri::AppHandle) -> PathBuf {
  let path = publish_config_path(app_handle);
  if let Some(parent) = path.parent() {
    let _ = fs::create_dir_all(parent);
  }
  if !path.exists() {
    let default = PublishPlatformsConfig { platforms: vec![] };
    let _ = fs::write(&path, serde_json::to_string_pretty(&default).unwrap_or_else(|_| "{}".into()));
  }
  path
}

#[tauri::command]
fn list_publish_platforms(app_handle: tauri::AppHandle) -> Result<PublishPlatformsConfig, String> {
  let path = ensure_publish_config(&app_handle);
  let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
  let cfg: PublishPlatformsConfig = serde_json::from_str(&content).map_err(|e| e.to_string())?;
  Ok(cfg)
}

#[tauri::command]
fn add_publish_platform(app_handle: tauri::AppHandle, platform: PublishPlatformConfig) -> Result<(), String> {
  let path = ensure_publish_config(&app_handle);
  let mut cfg = list_publish_platforms(app_handle.clone())?;
  if cfg.platforms.iter().any(|p| p.name == platform.name) {
    return Err(format!("配置名称已存在：{}", platform.name));
  }
  cfg.platforms.push(platform);
  fs::write(path, serde_json::to_string_pretty(&cfg).unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_publish_platform(app_handle: tauri::AppHandle, name: String, platform: PublishPlatformConfig) -> Result<(), String> {
  let path = ensure_publish_config(&app_handle);
  let mut cfg = list_publish_platforms(app_handle.clone())?;
  let index = cfg.platforms.iter().position(|p| p.name == name);
  match index {
    Some(idx) => {
      cfg.platforms[idx] = platform;
      fs::write(path, serde_json::to_string_pretty(&cfg).unwrap()).map_err(|e| e.to_string())
    }
    None => Err(format!("配置不存在：{}", name)),
  }
}

#[tauri::command]
fn delete_publish_platform(app_handle: tauri::AppHandle, name: String) -> Result<(), String> {
  let path = ensure_publish_config(&app_handle);
  let mut cfg = list_publish_platforms(app_handle.clone())?;
  let index = cfg.platforms.iter().position(|p| p.name == name);
  match index {
    Some(idx) => {
      cfg.platforms.remove(idx);
      fs::write(path, serde_json::to_string_pretty(&cfg).unwrap()).map_err(|e| e.to_string())
    }
    None => Err(format!("配置不存在：{}", name)),
  }
}

#[derive(Serialize)]
struct PublishResult {
  success: bool,
  message: String,
  download_url: Option<String>,
  qr_code_url: Option<String>,
  build_key: Option<String>,
  build_shortcut_url: Option<String>,
}

/// 上传到蒲公英（使用快速上传API，参考官方Node.js示例）
/// 参考: https://github.com/PGYER/upload-app-api-example/tree/main/nodejs-demo
async fn upload_to_pgyer(file_path: &Path, config: &PublishConfig) -> Result<PublishResult, String> {
  if config.api_key.is_none() {
    return Err("蒲公英 API Key 未配置".to_string());
  }

  log::info!("开始上传到蒲公英（快速上传模式），文件: {:?}", file_path);
  
  let file_name = file_path
    .file_name()
    .and_then(|n| n.to_str())
    .ok_or("无法获取文件名")?;
  
  let file_metadata = tokio::fs::metadata(file_path)
    .await
    .map_err(|e| format!("获取文件信息失败: {}", e))?;
  let file_size = file_metadata.len();
  log::info!("文件: {}, 大小: {} bytes ({:.2} MB)", file_name, file_size, file_size as f64 / 1024.0 / 1024.0);
  
  // 优化HTTP客户端配置以提高上传速度
  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(300)) // 5分钟超时，适合大文件上传
    .connect_timeout(std::time::Duration::from_secs(30)) // 30秒连接超时
    .tcp_keepalive(std::time::Duration::from_secs(60)) // TCP keepalive
    .pool_max_idle_per_host(2) // 每个主机最多2个空闲连接
    .build()
    .map_err(|e| format!("创建HTTP客户端失败: {}", e))?;
  
  // 步骤1: 获取上传凭证（getCOSToken）
  log::info!("步骤1: 获取上传凭证...");
  let mut token_form = Form::new()
    .text("_api_key", config.api_key.as_ref().unwrap().clone())
    .text("buildType", "android");
  
  if let Some(ref desc) = config.update_description {
    if !desc.trim().is_empty() {
      token_form = token_form.text("buildUpdateDescription", desc.trim().to_string());
      log::info!("已设置更新描述: {}", desc.trim());
    }
  }
  
  if let Some(ref password) = config.password {
    token_form = token_form
      .text("buildInstallType", "2")  // 2 = 密码安装
      .text("buildPassword", password.clone());
    log::info!("已设置安装密码");
  }
  
  log::info!("步骤1: 发送获取凭证请求到: https://api.pgyer.com/apiv2/app/getCOSToken");
  let token_response = client
    .post("https://api.pgyer.com/apiv2/app/getCOSToken")
    .multipart(token_form)
    .send()
    .await
    .map_err(|e| {
      log::error!("步骤1: 请求失败: {}", e);
      format!("获取上传凭证失败: {}", e)
    })?;
  
  let status = token_response.status();
  log::info!("步骤1: 响应状态码: {}", status);
  
  let token_result: serde_json::Value = token_response
    .json()
    .await
    .map_err(|e| {
      log::error!("步骤1: 解析响应失败: {}", e);
      format!("解析凭证响应失败: {}", e)
    })?;
  
  log::info!("步骤1: 响应内容: {}", serde_json::to_string_pretty(&token_result).unwrap_or_default());
  
  if token_result["code"].as_i64() != Some(0) {
    let error_msg = format!(
      "获取上传凭证失败: {}",
      token_result["message"]
        .as_str()
        .unwrap_or("未知错误")
    );
    log::error!("步骤1: {}", error_msg);
    return Err(error_msg);
  }
  
  let token_data = &token_result["data"];
  let endpoint = token_data["endpoint"]
    .as_str()
    .ok_or("无法获取上传端点")?
    .to_string();
  let key = token_data["key"]
    .as_str()
    .ok_or("无法获取上传密钥")?
    .to_string();
  let params = token_data["params"]
    .as_object()
    .ok_or("无法获取上传参数")?;
  
  // 提前提取所有参数到 String，避免生命周期问题
  let mut params_vec: Vec<(String, String)> = Vec::new();
  for (param_key, param_value) in params {
    if let Some(value) = param_value.as_str() {
      params_vec.push((param_key.clone(), value.to_string()));
    }
  }
  
  let params_count = params_vec.len();
  log::info!("步骤1: 成功获取上传凭证，端点: {}, 参数数量: {}", endpoint, params_count);
  
  // 步骤2: 上传文件到COS
  log::info!("步骤2: 开始上传文件到COS...");
  let start_time = std::time::Instant::now();
  
  // 读取文件内容
  let file_bytes = tokio::fs::read(file_path)
    .await
    .map_err(|e| format!("读取文件失败: {}", e))?;
  
  let file_part = Part::bytes(file_bytes)
    .file_name(file_name.to_string())
    .mime_str("application/vnd.android.package-archive")
    .map_err(|e| format!("创建文件部分失败: {}", e))?;
  
  // 构建上传表单，只包含文件（COS要求）
  let upload_form = Form::new().part("file", file_part);
  
  // 构建HTTP请求，将签名参数作为URL查询参数或headers
  log::info!("步骤2: 上传到COS端点: {}, 参数数量: {}", endpoint, params_count);
  
  // 解析endpoint URL，添加查询参数
  let mut url = reqwest::Url::parse(&endpoint).map_err(|e| format!("解析COS端点URL失败: {}", e))?;
  
  // 分离参数：signature 和 key 作为查询参数，x-cos-security-token 作为 header
  let mut security_token: Option<String> = None;
  for (param_key, param_value) in params_vec {
    if param_key == "x-cos-security-token" {
      security_token = Some(param_value);
      log::info!("步骤2: 将 {} 作为 header", param_key);
    } else {
      // signature 和 key 作为 URL 查询参数
      url.query_pairs_mut().append_pair(&param_key, &param_value);
      log::info!("步骤2: 添加查询参数: {} = {}...", param_key, &param_value[..param_value.len().min(50)]);
    }
  }
  
  let mut request_builder = client.post(url).multipart(upload_form);
  
  // 添加 x-cos-security-token 作为 header
  if let Some(token) = security_token {
    request_builder = request_builder.header("x-cos-security-token", token);
  }
  
  let upload_response = request_builder
    .send()
    .await
    .map_err(|e| {
      let elapsed = start_time.elapsed();
      log::error!("步骤2: 上传请求失败 (耗时: {:.2}秒): {}", elapsed.as_secs_f64(), e);
      format!("上传文件失败 (耗时: {:.2}秒): {}", elapsed.as_secs_f64(), e)
    })?;
  
  let upload_elapsed = start_time.elapsed();
  let upload_status = upload_response.status();
  log::info!("步骤2: 文件上传完成，耗时: {:.2}秒，HTTP状态码: {}", upload_elapsed.as_secs_f64(), upload_status);
  
  // 检查上传响应状态
  if !upload_status.is_success() {
    // 尝试读取响应内容以便调试
    let response_text = upload_response.text().await.unwrap_or_default();
    log::error!("步骤2: 上传失败，HTTP状态码: {}，响应内容: {}", upload_status, response_text);
    return Err(format!("上传文件失败，HTTP状态码: {}", upload_status));
  }
  
  log::info!("步骤2: COS上传成功，准备检查上传状态");
  
  // 步骤3: 检查上传状态并获取应用信息（带重试机制）
  log::info!("步骤3: 检查上传状态，buildKey: {}", key);
  
  let api_key = config.api_key.as_ref().unwrap().clone();
  let max_retries = 60; // 最多重试60次（约3-5分钟）
  let mut retry_count = 0;
  
  loop {
    let info_form = Form::new()
      .text("_api_key", api_key.clone())
      .text("buildKey", key.clone());
    
    log::info!("步骤3: 发送请求到: https://api.pgyer.com/apiv2/app/buildInfo (尝试 {}/{})", retry_count + 1, max_retries);
    let info_response = client
      .post("https://api.pgyer.com/apiv2/app/buildInfo")
      .multipart(info_form)
      .send()
      .await
      .map_err(|e| {
        log::error!("步骤3: 请求失败: {}", e);
        format!("检查上传状态失败: {}", e)
      })?;
    
    let info_status = info_response.status();
    log::info!("步骤3: 响应状态码: {}", info_status);
    
    let info_result: serde_json::Value = info_response
      .json()
      .await
      .map_err(|e| {
        log::error!("步骤3: 解析响应失败: {}", e);
        format!("解析状态响应失败: {}", e)
      })?;
    
    log::info!("步骤3: 响应内容: {}", serde_json::to_string_pretty(&info_result).unwrap_or_default());
    
    let code = info_result["code"].as_i64();
    
    // 成功：code = 0
    if code == Some(0) {
      let data = &info_result["data"];
      let download_url = data["buildShortcutUrl"]
        .as_str()
        .map(|s| format!("https://www.pgyer.com/{}", s));
      
      let total_elapsed = start_time.elapsed();
      log::info!("步骤3: 上传成功，总耗时: {:.2}秒，重试次数: {}", total_elapsed.as_secs_f64(), retry_count);
      log::info!("步骤3: 下载链接: {:?}", download_url);
      log::info!("步骤3: 二维码: {:?}", data["buildQRCodeURL"].as_str());
      
      return Ok(PublishResult {
        success: true,
        message: "上传成功".to_string(),
        download_url,
        qr_code_url: data["buildQRCodeURL"].as_str().map(|s| s.to_string()),
        build_key: data["buildKey"].as_str().map(|s| s.to_string()),
        build_shortcut_url: data["buildShortcutUrl"].as_str().map(|s| s.to_string()),
      });
    }
    
    // 处理中：code = 1247，需要重试
    if code == Some(1247) {
      retry_count += 1;
      
      if retry_count >= max_retries {
        let error_msg = format!(
          "检查上传状态超时: 已重试 {} 次，应用仍在处理中",
          max_retries
        );
        log::error!("步骤3: {}", error_msg);
        return Err(error_msg);
      }
      
      // 随机等待 3-5 秒
      let wait_seconds = 3 + (retry_count % 3); // 3, 4, 5 秒循环
      log::info!("步骤3: 应用正在处理中 (code: 1247)，等待 {} 秒后重试...", wait_seconds);
      tokio::time::sleep(std::time::Duration::from_secs(wait_seconds)).await;
      continue;
    }
    
    // 其他错误：直接返回
    let error_msg = format!(
      "检查上传状态失败: {}",
      info_result["message"]
        .as_str()
        .unwrap_or("未知错误")
    );
    log::error!("步骤3: {}", error_msg);
    log::error!("步骤3: 完整响应: {}", serde_json::to_string_pretty(&info_result).unwrap_or_default());
    return Err(error_msg);
  }
}

/// 尝试使用 go-fir-cli 命令行工具上传（备选方案）
async fn upload_to_fir_via_cli(file_path: &Path, config: &PublishConfig) -> Result<PublishResult, String> {
  log::warn!("尝试使用 go-fir-cli 命令行工具上传");
  
  // 检查文件是否存在
  if !file_path.exists() {
    let err = format!("文件不存在: {:?}", file_path);
    log::error!("{}", err);
    return Err(err);
  }
  
  // 查找 go-fir-cli 工具
  let cli_names = ["go-fir-cli"];
  let mut cli_path: Option<String> = None;
  let mut search_errors = Vec::new();
  
  log::warn!("查找 go-fir-cli 工具...");
  
  // 方法1: 使用 which 命令查找（可能在沙箱环境中失败）
  for name in &cli_names {
    log::warn!("使用 which 命令查找: {}", name);
    let (ok, output) = run_command("which", &[name]);
    log::warn!("which 查找结果 - 成功: {}, 输出: '{}'", ok, output);
    
    if ok && !output.is_empty() {
      let trimmed = output.trim().to_string();
      // 验证路径是否有效
      if Path::new(&trimmed).exists() {
        cli_path = Some(trimmed);
        log::warn!("找到 go-fir-cli: {}", cli_path.as_ref().unwrap());
        break;
      } else {
        search_errors.push(format!("which 找到路径但文件不存在: {}", trimmed));
        log::warn!("路径存在但文件不存在: {}", trimmed);
      }
    } else {
      search_errors.push(format!("which 未找到 {}: {}", name, output));
      log::warn!("which 未找到 {}: {}", name, output);
    }
  }
  
  // 如果 which 命令失败，尝试从配置中读取路径
  log::warn!("方法1完成，cli_path: {:?}", cli_path);
  if cli_path.is_none() {
    log::warn!("方法1未找到 go-fir-cli，开始方法2：从配置中读取路径");
    log::warn!("配置中的 go_fir_cli_path: {:?}", config.go_fir_cli_path);
    
    if let Some(ref configured_path) = config.go_fir_cli_path {
      log::warn!("配置中有路径，尝试使用: {}", configured_path);
      let trimmed_path = configured_path.trim();
      log::warn!("去除空格后的路径: '{}'", trimmed_path);
      
      if !trimmed_path.is_empty() {
        log::warn!("路径不为空，检查文件是否存在...");
        let path = Path::new(trimmed_path);
        log::warn!("Path对象: {:?}", path);
        
        if path.exists() {
          cli_path = Some(trimmed_path.to_string());
          log::warn!("✅ 使用配置中的路径找到 go-fir-cli: {}", trimmed_path);
        } else {
          search_errors.push(format!("配置的路径不存在: {}", trimmed_path));
          log::error!("❌ 配置的路径不存在: {}", trimmed_path);
        }
      } else {
        log::warn!("配置的路径为空字符串");
        search_errors.push("配置的路径为空字符串".to_string());
      }
    } else {
      log::warn!("配置中没有 go_fir_cli_path");
      search_errors.push("配置中没有设置 go-fir-cli 路径".to_string());
    }
  } else {
    log::warn!("方法1已找到 go-fir-cli，跳过方法2");
  }
  
  log::warn!("方法2完成，最终 cli_path: {:?}", cli_path);
  
  let cli = cli_path.ok_or_else(|| {
    let mut err_msg = "未找到 go-fir-cli 工具\n\n".to_string();
    err_msg.push_str("解决方法：\n");
    err_msg.push_str("1. 在发布配置中设置 go-fir-cli 安装路径（推荐）\n");
    err_msg.push_str("   - 进入\"发布配置\"页面\n");
    err_msg.push_str("   - 编辑或创建 fir.im 配置\n");
    err_msg.push_str("   - 在\"go-fir-cli 安装路径\"字段中填写完整路径\n");
    err_msg.push_str("   - 例如：/usr/local/bin/go-fir-cli 或 /Users/username/go/bin/go-fir-cli\n\n");
    err_msg.push_str("2. 或者安装 go-fir-cli 到 PATH 中：\n");
    err_msg.push_str("   - 访问 https://github.com/PGYER/go-fir-cli/releases\n");
    err_msg.push_str("   - 下载对应平台的二进制文件\n");
    err_msg.push_str("   - 将文件放到 PATH 环境变量中的目录（如 /usr/local/bin）\n");
    err_msg.push_str("   - 确保文件有执行权限：chmod +x /usr/local/bin/go-fir-cli\n\n");
    
    if !search_errors.is_empty() {
      err_msg.push_str("查找详情：\n");
      for (i, err) in search_errors.iter().enumerate() {
        err_msg.push_str(&format!("  {}. {}\n", i + 1, err));
      }
    }
    
    log::error!("{}", err_msg);
    err_msg
  })?;
  
  // 检查并修复执行权限
  let cli_path_obj = Path::new(&cli);
  log::warn!("检查 go-fir-cli 执行权限: {}", cli);
  
  // 检查文件元数据
  if let Ok(metadata) = fs::metadata(cli_path_obj) {
    #[cfg(unix)]
    {
      use std::os::unix::fs::PermissionsExt;
      let permissions = metadata.permissions();
      let mode = permissions.mode();
      let is_executable = (mode & 0o111) != 0; // 检查是否有执行权限
      
      log::warn!("文件权限模式: {:o}, 可执行: {}", mode, is_executable);
      
      if !is_executable {
        log::warn!("文件没有执行权限，尝试添加执行权限...");
        // 尝试使用 chmod 命令添加执行权限
        let (chmod_ok, chmod_output) = run_command("chmod", &["+x", &cli]);
        if chmod_ok {
          log::warn!("成功添加执行权限");
        } else {
          log::error!("无法添加执行权限: {}", chmod_output);
          let err_msg = format!(
            "go-fir-cli 文件没有执行权限，且无法自动修复\n\n\
            文件路径: {}\n\
            错误: {}\n\n\
            请手动执行以下命令添加执行权限：\n\
            chmod +x {}\n",
            cli, chmod_output, cli
          );
          return Err(err_msg);
        }
      }
    }
  } else {
    log::warn!("无法获取文件元数据，继续尝试执行");
  }
  
  // 构建命令：go-fir-cli -t TOKEN upload -f FILE_PATH [-c CHANGELOG]
  let file_path_str = file_path.to_string_lossy().to_string();
  let token = config.api_token.as_ref().unwrap();
  
  log::warn!("执行命令: {} -t {}... upload -f {}", cli, &token[..token.len().min(10)], file_path_str);
  
  let mut cmd = Command::new(&cli);
  cmd.arg("-t").arg(token).arg("upload").arg("-f").arg(&file_path_str);
  
  // 如果有更新描述，添加 -c 参数
  if let Some(ref desc) = config.update_description {
    if !desc.trim().is_empty() {
      log::warn!("添加更新描述: {}", desc.trim());
      cmd.arg("-c").arg(desc.trim());
    }
  }
  
  log::warn!("开始执行 go-fir-cli 命令...");
  let output = cmd
    .output()
    .await
    .map_err(|e| {
      let err_str = e.to_string();
      let mut err = format!("执行 go-fir-cli 失败: {}\n\n", err_str);
      
      // 检查是否是权限问题
      if err_str.contains("Permission denied") || err_str.contains("permission") {
        err.push_str("这可能是权限问题。请尝试以下方法：\n");
        err.push_str(&format!("1. 手动添加执行权限：chmod +x {}\n", cli));
        err.push_str("2. 或者使用 sudo 运行应用（不推荐）\n");
        err.push_str("3. 检查文件所有者是否正确\n\n");
      }
      
      err.push_str(&format!("文件路径: {}\n", cli));
      err.push_str("请确保 go-fir-cli 已正确安装并在 PATH 中，且有执行权限");
      
      log::error!("{}", err);
      err
    })?;
  
  let stdout = String::from_utf8_lossy(&output.stdout);
  let stderr = String::from_utf8_lossy(&output.stderr);
  let exit_code = output.status.code().unwrap_or(-1);
  
  log::warn!("go-fir-cli 退出码: {}", exit_code);
  log::warn!("go-fir-cli 标准输出: {}", stdout);
  if !stderr.is_empty() {
    log::warn!("go-fir-cli 错误输出: {}", stderr);
  }
  
  if output.status.success() {
    // 解析输出以提取下载链接
    let mut download_url: Option<String> = None;
    let mut download_page_url: Option<String> = None;
    
    // 方法1: 从JSON响应中提取 download_url
    // 查找包含 "download_url" 的JSON行
    // for line in stdout.lines() {
    //   let line = line.trim();
    //   if line.contains("download_url") && line.starts_with('{') {
    //     if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(line) {
    //       if let Some(url) = json_value["download_url"].as_str() {
    //         download_url = Some(url.to_string());
    //         log::info!("从JSON中提取到下载链接: {}", url);
    //         break;
    //       }
    //     }
    //   }
    // }
    
    // 方法2: 从应用信息JSON中提取 short 和 download_domain，构建下载页面URL
    // for line in stdout.lines() {
    //   let line = line.trim();
    //   if line.contains("\"short\"") && line.contains("\"download_domain\"") && line.starts_with('{') {
    //     if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(line) {
    //       if let (Some(short), Some(domain)) = (
    //         json_value["short"].as_str(),
    //         json_value["download_domain"].as_str(),
    //       ) {
    //         // 构建下载页面URL: http://{domain}/{short}
    //         let page_url = format!("http://{}/{}", domain, short);
    //         download_page_url = Some(page_url.clone());
    //         log::info!("从应用信息JSON中提取到下载页面: {}", page_url);
            
    //         // 如果没有找到直接下载链接，使用下载页面作为备用
    //         if download_url.is_none() {
    //           download_url = Some(page_url);
    //         }
    //         break;
    //       }
    //     }
    //   }
    // }
    
    // 方法3: 从文本中提取 "下载页面: " 后面的URL
    if download_page_url.is_none() {
      for line in stdout.lines() {
        if line.contains("下载页面:") {
          if let Some(start_idx) = line.find("下载页面:") {
            let url_part = &line[start_idx + "下载页面:".len()..].trim();
            if !url_part.is_empty() {
              download_page_url = Some(url_part.to_string());
              log::info!("从文本中提取到下载页面: {}", url_part);
              
              // 如果没有找到直接下载链接，使用下载页面作为备用
              if download_url.is_none() {
                download_url = Some(url_part.to_string());
              }
              break;

            }
          }
        }
      }
    }
    
    log::warn!("go-fir-cli 上传成功");
    Ok(PublishResult {
      success: true,
      message: format!("fir.im 上传成功"),
      download_url,
      qr_code_url: None,
      build_key: None,
      build_shortcut_url: download_page_url,
    })
  } else {
    let error_msg = format!(
      "go-fir-cli 上传失败（退出码: {}）\n标准输出: {}\n错误输出: {}",
      exit_code, stdout, stderr
    );
    log::error!("{}", error_msg);
    Err(error_msg)
  }
}

/// 上传到 fir.im（使用 go-fir-cli 命令行工具）
async fn upload_to_fir(file_path: &Path, config: &PublishConfig) -> Result<PublishResult, String> {
  if config.api_token.is_none() {
    let err = "fir.im API Token 未配置".to_string();
    log::error!("{}", err);
    return Err(err);
  }

  log::warn!("开始上传到 fir.im（使用 go-fir-cli 工具），文件: {:?}", file_path);
  log::warn!("API Token: {}...", &config.api_token.as_ref().unwrap()[..config.api_token.as_ref().unwrap().len().min(10)]);

  // 直接使用 go-fir-cli 命令行工具上传
  match upload_to_fir_via_cli(file_path, config).await {
    Ok(result) => {
      log::warn!("fir.im 上传成功: {}", result.message);
      Ok(result)
    }
    Err(e) => {
      log::error!("fir.im 上传失败: {}", e);
      Err(e)
    }
  }
}

#[tauri::command]
async fn publish_apk(
  file_path: String,
  config: PublishConfig,
) -> Result<PublishResult, String> {
  log::warn!("开始发布 APK，文件: {}, 平台: {}", file_path, config.platform);
  
  let path = Path::new(&file_path);
  if !path.exists() {
    let err = format!("文件不存在: {}", file_path);
    log::error!("{}", err);
    return Err(err);
  }

  if !file_path.ends_with(".apk") && !file_path.ends_with(".aab") {
    let err = "不支持的文件类型，仅支持 .apk 或 .aab 文件".to_string();
    log::error!("{}", err);
    return Err(err);
  }

  let result = match config.platform.as_str() {
    "pgyer" => {
      log::warn!("使用蒲公英平台发布");
      upload_to_pgyer(path, &config).await
    }
    "fir" => {
      log::warn!("使用 fir.im 平台发布");
      upload_to_fir(path, &config).await
    }
    _ => {
      let err = format!("不支持的发布平台: {}", config.platform);
      log::error!("{}", err);
      return Err(err);
    }
  };
  
  // 将 Err 转换为 PublishResult，确保前端能显示错误信息
  match result {
    Ok(r) => {
      if r.success {
        log::warn!("发布成功: {}", r.message);
      } else {
        log::error!("发布失败: {}", r.message);
      }
      Ok(r)
    }
    Err(e) => {
      log::error!("发布过程出错: {}", e);
      // 将错误转换为 PublishResult，这样前端就能正常显示了
      Ok(PublishResult {
        success: false,
        message: e,
        download_url: None,
        qr_code_url: None,
        build_key: None,
        build_shortcut_url: None,
      })
    }
  }
}

/// 打开目录（在文件管理器中显示）
#[tauri::command]
fn open_directory(path: String) -> Result<(), String> {
  let dir_path = Path::new(&path);
  if !dir_path.exists() {
    return Err(format!("目录不存在: {}", path));
  }
  
  if !dir_path.is_dir() {
    return Err(format!("路径不是目录: {}", path));
  }
  
  // 在 macOS 上使用 `open` 命令打开目录
  #[cfg(target_os = "macos")]
  {
    let output = StdCommand::new("open")
      .arg(&path)
      .output()
      .map_err(|e| format!("打开目录失败: {}", e))?;
    
    if !output.status.success() {
      let error_msg = String::from_utf8_lossy(&output.stderr);
      return Err(format!("打开目录失败: {}", error_msg));
    }
  }
  
  // 在 Windows 上使用 `explorer` 命令
  #[cfg(target_os = "windows")]
  {
    let output = StdCommand::new("explorer")
      .arg(&path)
      .output()
      .map_err(|e| format!("打开目录失败: {}", e))?;
    
    if !output.status.success() {
      let error_msg = String::from_utf8_lossy(&output.stderr);
      return Err(format!("打开目录失败: {}", error_msg));
    }
  }
  
  // 在 Linux 上使用 `xdg-open` 命令
  #[cfg(target_os = "linux")]
  {
    let output = StdCommand::new("xdg-open")
      .arg(&path)
      .output()
      .map_err(|e| format!("打开目录失败: {}", e))?;
    
    if !output.status.success() {
      let error_msg = String::from_utf8_lossy(&output.stderr);
      return Err(format!("打开目录失败: {}", error_msg));
    }
  }
  
  Ok(())
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      // 在生产模式和开发模式都启用日志，方便排查问题
      // 开发模式：Info 级别，生产模式：Warn 级别（减少日志量，但保留错误信息）
      let log_level = if cfg!(debug_assertions) {
        log::LevelFilter::Info
      } else {
        log::LevelFilter::Warn
      };
      
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log_level)
          .build(),
      )?;
      
      // 设置窗口大小为屏幕的 2/3
      if let Some(window) = app.get_webview_window("main") {
        if let Ok(monitor) = window.current_monitor() {
          if let Some(monitor) = monitor {
            let screen_size = monitor.size();
            let width = (screen_size.width as f64 * 0.667) as u32;
            let height = (screen_size.height as f64 * 0.667) as u32;
            
            if let Err(e) = window.set_size(tauri::LogicalSize::new(width, height)) {
              eprintln!("设置窗口大小失败: {:?}", e);
            }
            
            // 居中窗口
            let x = (screen_size.width as f64 * 0.167) as i32;
            let y = (screen_size.height as f64 * 0.167) as i32;
            if let Err(e) = window.set_position(tauri::LogicalPosition::new(x, y)) {
              eprintln!("设置窗口位置失败: {:?}", e);
            }
          }
        }
      }
      
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      check_env,
      list_projects,
      add_project,
      update_project,
      delete_project,
      build_project,
      publish_apk,
      list_publish_platforms,
      add_publish_platform,
      update_publish_platform,
      delete_publish_platform,
      open_directory
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

