import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import {
  App as AntdApp,
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  ConfigProvider,
  Form,
  Input,
  Layout,
  List,
  Modal,
  Menu,
  message,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import type { ThemeConfig } from "antd";
import { 
  CheckCircleTwoTone, 
  CloseCircleTwoTone, 
  PlayCircleOutlined, 
  PlusOutlined, 
  ReloadOutlined,
  ToolOutlined,
  FolderOutlined,
  RocketOutlined,
  EnvironmentOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
  CloudUploadOutlined,
  EditOutlined
} from "@ant-design/icons";
import "./App.css";

type EnvCheck = { tool: string; ok: boolean; message: string; detail?: string };
type Project = { name: string; path: string; defaultModule?: string; modules?: string[]; defaultVariant?: string; variants?: string[]; buildType?: "Debug" | "Release" };
type ProjectsConfig = { projects: Project[] };
type BuildResult = { code: number; output: string };
type PublishResult = { success: boolean; message: string; download_url?: string; qr_code_url?: string; build_key?: string; build_shortcut_url?: string };
type PublishPlatformConfig = { name: string; platform: string; api_key?: string; api_token?: string; password?: string; default_description?: string };
type PublishPlatformsConfig = { platforms: PublishPlatformConfig[] };

const statusTag = (ok: boolean) => (
  <Tag
    className={ok ? "ds-tag--ok" : "ds-tag--bad"}
    icon={
      ok ? (
        <CheckCircleTwoTone twoToneColor="#10B981" />
      ) : (
        <CloseCircleTwoTone twoToneColor="#EF4444" />
      )
    }
  >
    {ok ? "正常" : "异常"}
  </Tag>
);

const dsTheme: ThemeConfig = {
  token: {
    colorPrimary: "#3B82F6",
    colorInfo: "#3B82F6",
    colorSuccess: "#10B981",
    colorWarning: "#F59E0B",
    colorError: "#EF4444",
    colorText: "#111827",
    colorTextSecondary: "#374151",
    colorBgLayout: "#F3F4F6",
    colorBgContainer: "#FFFFFF",
    colorBorder: "#E5E7EB",
    borderRadius: 8,
    fontFamily:
      '"Outfit",-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
    boxShadow: "none",
    boxShadowSecondary: "none",
    boxShadowTertiary: "none",
  },
};

function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const [selectedMenu, setSelectedMenu] = useState<"env" | "projects" | "build" | "publish">("env");
  const [envLoading, setEnvLoading] = useState(false);
  const [envChecks, setEnvChecks] = useState<EnvCheck[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [publishPlatforms, setPublishPlatforms] = useState<PublishPlatformConfig[]>([]);
  const [publishPlatformsLoading, setPublishPlatformsLoading] = useState(false);
  const [addForm] = Form.useForm();
  const [publishPlatformForm] = Form.useForm<PublishPlatformConfig>();
  const [buildForm] = Form.useForm<{ 
    project: string; 
    module?: string; 
    variant?: string; 
    buildType?: "Debug" | "Release";
    publish?: boolean;
    publishPlatformConfig?: string;
    publishPlatform?: "pgyer" | "fir";
    publishApiKey?: string;
    publishApiToken?: string;
    publishPassword?: string;
    publishDescription?: string;
  }>();
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [building, setBuilding] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [buildLogCollapsed, setBuildLogCollapsed] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [publishPlatformModalOpen, setPublishPlatformModalOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<PublishPlatformConfig | null>(null);
  const [addingPlatform, setAddingPlatform] = useState(false);

  const loadEnv = async () => {
    setEnvLoading(true);
    try {
      const res = await invoke<EnvCheck[]>("check_env");
      setEnvChecks(res);
    } finally {
      setEnvLoading(false);
    }
  };

  const loadProjects = async () => {
    setProjectsLoading(true);
    try {
      const res = await invoke<ProjectsConfig>("list_projects");
      setProjects(res.projects ?? []);
    } finally {
      setProjectsLoading(false);
    }
  };

  const loadPublishPlatforms = async () => {
    setPublishPlatformsLoading(true);
    try {
      const res = await invoke<PublishPlatformsConfig>("list_publish_platforms");
      setPublishPlatforms(res.platforms ?? []);
    } finally {
      setPublishPlatformsLoading(false);
    }
  };

  useEffect(() => {
    loadEnv();
    loadProjects();
    loadPublishPlatforms();
  }, []);

  const projectOptions = useMemo(
    () => projects.map((p) => ({ label: `${p.name} (${p.path})`, value: p.name })),
    [projects],
  );

  // 获取选中工程的模块选项列表
  const getModuleOptions = (projectName?: string): string[] => {
    if (!projectName) return [];
    
    const selectedProject = projects.find(p => p.name === projectName);
    if (!selectedProject) return [];
    
    const options: string[] = [];
    // 添加配置的 modules
    if (selectedProject.modules && selectedProject.modules.length > 0) {
      options.push(...selectedProject.modules);
    }
    // 如果有 defaultModule 且不在列表中，也添加进去（兼容旧数据）
    if (selectedProject.defaultModule && !options.includes(selectedProject.defaultModule)) {
      options.push(selectedProject.defaultModule);
    }
    
    return options;
  };

  // 获取选中工程的 variant 选项列表
  const getVariantOptions = (projectName?: string): string[] => {
    if (!projectName) return [];
    
    const selectedProject = projects.find(p => p.name === projectName);
    if (!selectedProject) return [];
    
    const options: string[] = [];
    // 添加配置的 variants
    if (selectedProject.variants && selectedProject.variants.length > 0) {
      options.push(...selectedProject.variants);
    }
    // 如果有 defaultVariant 且不在列表中，也添加进去
    if (selectedProject.defaultVariant && !options.includes(selectedProject.defaultVariant)) {
      options.push(selectedProject.defaultVariant);
    }
    
    return options;
  };

  const handleAddProject = async (values: Project) => {
    setAdding(true);
    try {
      await invoke("add_project", { project: values });
      messageApi.success("工程已添加");
      addForm.resetFields();
      setAddModalOpen(false);
      setEditingProject(null);
      loadProjects();
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateProject = async (values: Project) => {
    if (!editingProject) return;
    setAdding(true);
    try {
      // 确保工程名不会被修改，使用原有的工程名
      const updateData = { ...values, name: editingProject.name };
      await invoke("update_project", { name: editingProject.name, project: updateData });
      messageApi.success("工程已更新");
      addForm.resetFields();
      setAddModalOpen(false);
      setEditingProject(null);
      loadProjects();
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    // 填充表单数据
    addForm.setFieldsValue({
      name: project.name,
      path: project.path,
      modules: project.modules || [],
      variants: project.variants || [],
      buildType: project.buildType || "Debug",
    });
    setAddModalOpen(true);
  };

  const handleDeleteProject = async (name: string) => {
    Modal.confirm({
      title: "确认删除",
      content: `确定要删除工程 "${name}" 吗？此操作不可恢复。`,
      okText: "删除",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        try {
          await invoke("delete_project", { name });
          messageApi.success("工程已删除");
          loadProjects();
        } catch (e) {
          messageApi.error((e as Error).message);
        }
      },
    });
  };

  const handleSelectDirectory = async () => {
    try {
      const result = await open({
        directory: true,
        multiple: false,
        recursive: false,
        title: "选择包含 gradlew 的工程目录",
      });
      console.log('选择目录返回结果:', result);
      console.log('result 类型:', typeof result);
      console.log('是否为 null:', result === null);
      
      if (result === null) {
        console.log('用户取消选择');
        return;
      }
      
      const selected = Array.isArray(result) ? result[0] : result;
      console.log('处理后的 selected:', selected);
      console.log('selected 类型:', typeof selected);
      
      if (selected && typeof selected === 'string') {
        console.log('准备设置表单字段值:', selected);
        // 使用 setFieldsValue 设置表单字段值
        addForm.setFieldsValue({ path: selected });
        // 强制触发表单更新
        addForm.validateFields(['path']).catch(() => {});
        // 验证字段值是否设置成功
        setTimeout(() => {
          const currentValue = addForm.getFieldValue('path');
          console.log('设置后的表单字段值:', currentValue);
        }, 0);
      }
    } catch (error) {
      console.error('选择目录时出错:', error);
      messageApi.error('选择目录失败');
    }
  };

  const handleBuild = async (values: {
    project: string;
    module?: string;
    variant?: string;
    buildType?: "Debug" | "Release";
    publish?: boolean;
    publishPlatformConfig?: string;
    publishPlatform?: "pgyer" | "fir";
    publishApiKey?: string;
    publishApiToken?: string;
    publishPassword?: string;
    publishDescription?: string;
  }) => {
    setBuilding(true);
    setBuildResult(null);
    setPublishResult(null);
    try {
      const res = await invoke<BuildResult>("build_project", {
        name: values.project,
        module: values.module || null,
        variant: values.variant || null,
        buildType: values.buildType || null,
        outputDir: null,
      });
      setBuildResult(res);
      
      // 如果构建成功且配置了发布，则自动发布
      if (res.code === 0 && values.publish) {
        // 如果选择了已保存的配置，从配置中获取信息
        let publishConfig: { platform: string; api_key?: string; api_token?: string; password?: string; update_description?: string } | null = null;
        
        // 获取更新描述：优先使用用户输入的，否则使用配置的默认值
        const updateDescription = values.publishDescription?.trim() || undefined;
        
        if (values.publishPlatformConfig) {
          // 从已保存的配置中获取
          const selected = publishPlatforms.find(p => p.name === values.publishPlatformConfig);
          if (selected) {
            publishConfig = {
              platform: selected.platform,
              api_key: selected.api_key,
              api_token: selected.api_token,
              password: selected.password,
              // 优先使用用户输入的更新描述，如果没有则使用配置的默认描述
              update_description: updateDescription || selected.default_description,
            };
          }
        } else if (values.publishPlatform) {
          // 使用手动输入的配置
          publishConfig = {
            platform: values.publishPlatform,
            api_key: values.publishApiKey,
            api_token: values.publishApiToken,
            password: values.publishPassword,
            update_description: updateDescription,
          };
        }
        
        if (!publishConfig || !publishConfig.platform) {
          messageApi.warning("请选择发布配置或填写发布信息");
          return;
        }
        
        // 从构建输出中提取 APK 文件路径
        // 输出格式类似：✅ 已复制: app-release.apk -> /path/to/output/app-release.apk
        const outputLines = res.output.split('\n');
        let apkPath: string | null = null;
        
        for (const line of outputLines) {
          if (line.includes('✅ 已复制:') && (line.includes('.apk') || line.includes('.aab'))) {
            // 提取文件路径（在 -> 之后）
            const match = line.match(/->\s*(.+)$/);
            if (match && match[1]) {
              apkPath = match[1].trim();
              break;
            }
          }
        }
        
        if (apkPath) {
          setPublishing(true);
          setPublishResult(null);
          // 开始发布时，折叠构建日志
          setBuildLogCollapsed(true);
          try {
            // 确保更新描述被正确传递（去除首尾空格，空字符串转为 null）
            const updateDesc = publishConfig.update_description?.trim();
            const finalUpdateDesc = updateDesc && updateDesc.length > 0 ? updateDesc : null;
            
            const publishRes = await invoke<PublishResult>("publish_apk", {
              filePath: apkPath,
              config: {
                platform: publishConfig.platform,
                api_key: publishConfig.api_key || null,
                api_token: publishConfig.api_token || null,
                password: publishConfig.password || null,
                update_description: finalUpdateDesc,
              },
            });
            setPublishResult(publishRes);
            if (publishRes.success) {
              messageApi.success("发布成功！");
            } else {
              messageApi.error(`发布失败: ${publishRes.message}`);
            }
          } catch (e) {
            setPublishResult({
              success: false,
              message: (e as Error).message,
            });
            messageApi.error(`发布出错: ${(e as Error).message}`);
          } finally {
            setPublishing(false);
          }
        } else {
          messageApi.warning("构建成功，但未找到 APK 文件路径，无法自动发布");
        }
      }
    } catch (e) {
      setBuildResult({ code: -1, output: (e as Error).message });
    } finally {
      setBuilding(false);
    }
  };

  const envSection = (
    <Card
      title={
        <span className="ds-cardTitle">
          <span className="ds-iconBadge">
            <ToolOutlined />
          </span>
          <span>环境检测</span>
        </span>
      }
      extra={
        <Button icon={<ReloadOutlined />} onClick={loadEnv} loading={envLoading} size="small">
          刷新环境
        </Button>
      }
      loading={envLoading}
    >
      {envChecks.length === 0 ? (
        <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '20px' }}>
          点击"刷新环境"按钮开始检测
        </Typography.Text>
      ) : (
        <List
          dataSource={envChecks}
          renderItem={(item) => (
            <List.Item>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <Typography.Text strong style={{ fontSize: '15px' }}>{item.tool}</Typography.Text>
                  {statusTag(item.ok)}
                </div>
                <Typography.Text type={item.ok ? "secondary" : "danger"} style={{ fontSize: '13px' }}>
                  {item.message}
                  {item.detail ? ` | ${item.detail}` : ""}
                </Typography.Text>
              </Space>
            </List.Item>
          )}
        />
      )}
    </Card>
  );

  const projectsSection = (
    <>
      <Card
        title={
          <span className="ds-cardTitle">
            <span className="ds-iconBadge">
              <FolderOutlined />
            </span>
            <span>工程管理</span>
          </span>
        }
        extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadProjects} loading={projectsLoading} size="small">
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)} size="small">
            添加新工程
          </Button>
        </Space>
        }
        loading={projectsLoading}
      >
        <List
          dataSource={projects}
          locale={{ emptyText: "暂无工程，请点击“添加新工程”" }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="edit"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => handleEditProject(item)}
                  size="small"
                >
                  编辑
                </Button>,
                <Button
                  key="delete"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteProject(item.name)}
                  size="small"
                >
                  删除
                </Button>,
              ]}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <FolderOutlined style={{ color: "var(--ds-primary)", fontSize: '16px' }} />
                  <Typography.Text strong style={{ fontSize: '15px' }}>{item.name}</Typography.Text>
                </Space>
                <Typography.Text type="secondary" style={{ fontSize: '13px', wordBreak: 'break-all' }}>
                  📍 {item.path}
                </Typography.Text>
                <Space wrap style={{ fontSize: '13px' }}>
                  {item.modules && item.modules.length > 0 ? (
                    <Tag className="ds-tag--primary">Modules: {item.modules.length} 个</Tag>
                  ) : item.defaultModule ? (
                    <Tag className="ds-tag--primary">模块: {item.defaultModule}</Tag>
                  ) : null}
                  {item.variants && item.variants.length > 0 && (
                    <Tag className="ds-tag--primary">Variants: {item.variants.length} 个</Tag>
                  )}
                </Space>
              </Space>
            </List.Item>
          )}
        />
      </Card>
      <Modal
        title={editingProject ? "编辑工程" : "添加新工程"}
        open={addModalOpen}
        onCancel={() => {
          setAddModalOpen(false);
          addForm.resetFields();
          setEditingProject(null);
        }}
        footer={null}
        destroyOnClose
        centered
      >
        <Form layout="vertical" form={addForm} onFinish={editingProject ? handleUpdateProject : handleAddProject}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item 
                name="name" 
                label="工程名" 
                rules={[{ required: true, message: "请输入工程名" }]}
              >
                <Input 
                  prefix={<FolderOutlined />} 
                  placeholder="如 demo-app" 
                  disabled={!!editingProject}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="工程路径" shouldUpdate={(prevValues, curValues) => prevValues?.path !== curValues?.path}>
            {({ getFieldValue }) => (
              <Form.Item 
                name="path" 
                rules={[{ required: true, message: "请选择工程目录（包含 gradlew）" }]}
              >
                <Space.Compact style={{ width: "100%" }}>
                  <Input
                    prefix={<EnvironmentOutlined />}
                    placeholder="请选择工程目录（包含 gradlew）"
                    readOnly
                    onClick={handleSelectDirectory}
                    value={getFieldValue('path') || ''}
                  />
                </Space.Compact>
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item
            label="Modules（模块列表）"
            tooltip="添加多个模块，构建时可以从列表中选择"
          >
            <Form.List name="modules">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item
                        {...restField}
                        name={[name]}
                        rules={[{ required: true, message: '请输入模块名称' }]}
                      >
                        <Input placeholder="如 app、lib" style={{ width: 300 }} />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(name)} />
                    </Space>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      添加 Module
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>
          <Form.Item
            label="Variants（构建变体列表）"
            tooltip="添加多个构建变体，构建时可以从列表中选择"
          >
            <Form.List name="variants">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item
                        {...restField}
                        name={[name]}
                        rules={[{ required: true, message: '请输入 Variant 名称' }]}
                      >
                        <Input placeholder="如 Ver-Dev、Ver-Prod" style={{ width: 300 }} />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(name)} />
                    </Space>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      添加 Variant
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={editingProject ? <EditOutlined /> : <PlusOutlined />}
              size="large"
              block
              loading={adding}
            >
              {adding ? (editingProject ? "更新中..." : "添加中...") : (editingProject ? "更新工程" : "添加工程")}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );

  const handleAddPublishPlatform = async (values: PublishPlatformConfig) => {
    setAddingPlatform(true);
    try {
      if (editingPlatform) {
        await invoke("update_publish_platform", { name: editingPlatform.name, platform: values });
        messageApi.success("配置已更新");
      } else {
        await invoke("add_publish_platform", { platform: values });
        messageApi.success("配置已添加");
      }
      publishPlatformForm.resetFields();
      setPublishPlatformModalOpen(false);
      setEditingPlatform(null);
      loadPublishPlatforms();
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setAddingPlatform(false);
    }
  };

  const handleEditPublishPlatform = (platform: PublishPlatformConfig) => {
    setEditingPlatform(platform);
    publishPlatformForm.setFieldsValue(platform);
    setPublishPlatformModalOpen(true);
  };

  const handleDeletePublishPlatform = async (name: string) => {
    Modal.confirm({
      title: "确认删除",
      content: `确定要删除发布配置 "${name}" 吗？此操作不可恢复。`,
      okText: "删除",
      okType: "danger",
      cancelText: "取消",
      onOk: async () => {
        try {
          await invoke("delete_publish_platform", { name });
          messageApi.success("配置已删除");
          loadPublishPlatforms();
        } catch (e) {
          messageApi.error((e as Error).message);
        }
      },
    });
  };

  const publishSection = (
    <>
      <Card
        title={
          <span className="ds-cardTitle">
            <span className="ds-iconBadge">
              <CloudUploadOutlined />
            </span>
            <span>发布平台配置</span>
          </span>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadPublishPlatforms} loading={publishPlatformsLoading} size="small">
              刷新
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => {
                setEditingPlatform(null);
                publishPlatformForm.resetFields();
                setPublishPlatformModalOpen(true);
              }} 
              size="small"
            >
              添加配置
            </Button>
          </Space>
        }
        loading={publishPlatformsLoading}
      >
        <List
          dataSource={publishPlatforms}
          locale={{ emptyText: "暂无配置，请点击添加配置" }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="edit"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => handleEditPublishPlatform(item)}
                  size="small"
                >
                  编辑
                </Button>,
                <Button
                  key="delete"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeletePublishPlatform(item.name)}
                  size="small"
                >
                  删除
                </Button>,
              ]}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <CloudUploadOutlined style={{ color: "var(--ds-primary)", fontSize: '16px' }} />
                  <Typography.Text strong style={{ fontSize: '15px' }}>{item.name}</Typography.Text>
                  <Tag className={item.platform === "pgyer" ? "ds-tag--primary" : "ds-tag--success"}>
                    {item.platform === "pgyer" ? "蒲公英" : "fir.im"}
                  </Tag>
                </Space>
                <Typography.Text type="secondary" style={{ fontSize: '13px' }}>
                  {item.platform === "pgyer" 
                    ? `API Key: ${item.api_key ? "已配置" : "未配置"}`
                    : `API Token: ${item.api_token ? "已配置" : "未配置"}`
                  }
                </Typography.Text>
                {item.default_description && (
                  <Typography.Text type="secondary" style={{ fontSize: '13px' }}>
                    默认描述: {item.default_description}
                  </Typography.Text>
                )}
              </Space>
            </List.Item>
          )}
        />
      </Card>
      <Modal
        title={editingPlatform ? "编辑发布配置" : "添加发布配置"}
        open={publishPlatformModalOpen}
        onCancel={() => {
          setPublishPlatformModalOpen(false);
          setEditingPlatform(null);
          publishPlatformForm.resetFields();
        }}
        footer={null}
        destroyOnClose
        centered
      >
        <Form layout="vertical" form={publishPlatformForm} onFinish={handleAddPublishPlatform}>
          <Form.Item name="name" label="配置名称" rules={[{ required: true, message: "请输入配置名称" }]}>
            <Input placeholder="如：生产环境蒲公英" />
          </Form.Item>
          <Form.Item name="platform" label="发布平台" rules={[{ required: true, message: "请选择发布平台" }]}>
            <Select placeholder="选择发布平台">
              <Select.Option value="pgyer">蒲公英 (Pgyer)</Select.Option>
              <Select.Option value="fir">fir.im</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues?.platform !== currentValues?.platform}
          >
            {({ getFieldValue }) => {
              const platform = getFieldValue('platform');
              if (platform === 'pgyer') {
                return (
                  <>
                    <Form.Item
                      name="api_key"
                      label="蒲公英 API Key"
                      rules={[{ required: true, message: "请输入 API Key" }]}
                    >
                      <Input.Password placeholder="在蒲公英平台获取 API Key" />
                    </Form.Item>
                    <Form.Item name="password" label="安装密码（可选）">
                      <Input.Password placeholder="设置安装密码" />
                    </Form.Item>
                  </>
                );
              } else if (platform === 'fir') {
                return (
                  <Form.Item
                    name="api_token"
                    label="fir.im API Token"
                    rules={[{ required: true, message: "请输入 API Token" }]}
                  >
                    <Input.Password placeholder="在 fir.im 平台获取 API Token" />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>
          <Form.Item name="default_description" label="默认更新描述（可选）">
            <Input.TextArea placeholder="输入默认的更新描述信息" rows={3} />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={editingPlatform ? <EditOutlined /> : <PlusOutlined />}
              size="large"
              block
              loading={addingPlatform}
            >
              {addingPlatform ? (editingPlatform ? "更新中..." : "添加中...") : (editingPlatform ? "更新配置" : "添加配置")}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );

  const buildSection = (
    <Card
      title={
        <span className="ds-cardTitle">
          <span className="ds-iconBadge">
            <RocketOutlined />
          </span>
          <span>构建打包</span>
        </span>
      }
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 20 }}>
        选择工程和构建配置，开始Android应用打包流程
      </Typography.Paragraph>
      <Form layout="vertical" form={buildForm} onFinish={handleBuild}>
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item 
              name="project" 
              label="目标工程" 
              rules={[{ required: true, message: "请选择工程" }]}
            >
              <Select
                placeholder="选择要构建的工程"
                size="large"
                options={projectOptions}
                loading={projectsLoading}
                suffixIcon={<FolderOutlined />}
                onChange={(projectName) => {
                  // 切换工程时，设置默认值（选中第一个）
                  const selectedProject = projects.find(p => p.name === projectName);
                  if (selectedProject) {
                    const moduleOptions = getModuleOptions(projectName);
                    const variantOptions = getVariantOptions(projectName);
                    
                    // 默认选中第一个模块
                    if (moduleOptions.length > 0) {
                      buildForm.setFieldsValue({ module: moduleOptions[0] });
                    } else {
                      buildForm.setFieldsValue({ module: undefined });
                    }
                    
                    // 默认选中第一个 variant
                    if (variantOptions.length > 0) {
                      buildForm.setFieldsValue({ variant: variantOptions[0] });
                    } else {
                      buildForm.setFieldsValue({ variant: undefined });
                    }
                    
                    // 默认选中 Debug
                    buildForm.setFieldsValue({ buildType: "Debug" });
                  }
                }}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues?.project !== currentValues?.project}
            >
              {({ getFieldValue }) => {
                const selectedProject = getFieldValue('project');
                const moduleOptions = getModuleOptions(selectedProject);
                return (
                  <Form.Item name="module" label="模块名称">
                    {moduleOptions.length > 0 ? (
                      <Select placeholder="选择模块" size="large" allowClear>
                        {moduleOptions.map(m => (
                          <Select.Option key={m} value={m}>{m}</Select.Option>
                        ))}
                      </Select>
                    ) : (
                      <Input placeholder="留空或手动输入模块名称" size="large" />
                    )}
                  </Form.Item>
                );
              }}
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues?.project !== currentValues?.project}
            >
              {({ getFieldValue }) => {
                const selectedProject = getFieldValue('project');
                const variantOptions = getVariantOptions(selectedProject);
                return (
                  <Form.Item 
                    name="variant" 
                    label="构建变体"
                    tooltip="从列表中选择构建变体。最终 variant 为：variant + BuildType。留空则使用工程配置的默认值"
                  >
                    {variantOptions.length > 0 ? (
                      <Select placeholder="选择构建变体" size="large" allowClear>
                        {variantOptions.map(v => (
                          <Select.Option key={v} value={v}>{v}</Select.Option>
                        ))}
                      </Select>
                    ) : (
                      <Input placeholder="如 Ver-Dev、debug（手动输入）" size="large" />
                    )}
                  </Form.Item>
                );
              }}
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item 
              name="buildType" 
              label="Build Type"
              tooltip="选择 Debug 或 Release。最终 variant 为：variant + BuildType。留空则使用工程配置的默认值"
              initialValue="Debug"
            >
              <Select placeholder="选择 Build Type" size="large">
                <Select.Option value="Debug">Debug</Select.Option>
                <Select.Option value="Release">Release</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="publish" valuePropName="checked">
          <Checkbox>构建成功后自动发布到平台</Checkbox>
        </Form.Item>
        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) => prevValues?.publish !== currentValues?.publish}
        >
          {({ getFieldValue }) => {
            const publishEnabled = getFieldValue('publish');
            if (!publishEnabled) return null;
            
            // 获取已保存的发布平台配置
            const savedPlatforms = publishPlatforms;
            const pgyerPlatforms = savedPlatforms.filter(p => p.platform === 'pgyer');
            const firPlatforms = savedPlatforms.filter(p => p.platform === 'fir');
            
            return (
              <>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="publishPlatformConfig"
                      label="选择已保存的配置（可选）"
                      tooltip="如果选择已保存的配置，将自动填充 API Key/Token 等信息"
                    >
                      <Select 
                        placeholder="选择已保存的配置或手动输入" 
                        size="large"
                        allowClear
                        onChange={(value) => {
                          if (value) {
                            const selected = savedPlatforms.find(p => p.name === value);
                            if (selected) {
                              buildForm.setFieldsValue({
                                publishPlatform: selected.platform as "pgyer" | "fir",
                                publishApiKey: selected.api_key,
                                publishApiToken: selected.api_token,
                                publishPassword: selected.password,
                                publishDescription: selected.default_description,
                              });
                            }
                          } else {
                            // 清空时重置字段
                            buildForm.setFieldsValue({
                              publishPlatform: undefined,
                              publishApiKey: undefined,
                              publishApiToken: undefined,
                              publishPassword: undefined,
                              publishDescription: undefined,
                            });
                          }
                        }}
                      >
                        {pgyerPlatforms.map(p => (
                          <Select.Option key={p.name} value={p.name}>
                            {p.name} (蒲公英)
                          </Select.Option>
                        ))}
                        {firPlatforms.map(p => (
                          <Select.Option key={p.name} value={p.name}>
                            {p.name} (fir.im)
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item
                  noStyle
                  shouldUpdate={(prevValues, currentValues) => 
                    prevValues?.publishPlatformConfig !== currentValues?.publishPlatformConfig
                  }
                >
                  {({ getFieldValue }) => {
                    const selectedConfig = getFieldValue('publishPlatformConfig');
                    // 如果选择了已保存的配置，不显示 API Key/Token 输入框
                    if (selectedConfig) {
                      return null;
                    }
                    
                    // 没有选择配置时，显示平台选择和 API Key/Token 输入框
                    return (
                      <>
                        <Row gutter={16}>
                          <Col span={12}>
                            <Form.Item
                              name="publishPlatform"
                              label="发布平台"
                              rules={[{ required: true, message: "请选择发布平台" }]}
                            >
                              <Select placeholder="选择发布平台" size="large">
                                <Select.Option value="pgyer">蒲公英 (Pgyer)</Select.Option>
                                <Select.Option value="fir">fir.im</Select.Option>
                              </Select>
                            </Form.Item>
                          </Col>
                        </Row>
                        <Form.Item
                          noStyle
                          shouldUpdate={(prevValues, currentValues) => 
                            prevValues?.publishPlatform !== currentValues?.publishPlatform
                          }
                        >
                          {({ getFieldValue }) => {
                            const platform = getFieldValue('publishPlatform');
                            if (platform === 'pgyer') {
                              return (
                                <>
                                  <Row gutter={16}>
                                    <Col span={24}>
                                      <Form.Item
                                        name="publishApiKey"
                                        label="蒲公英 API Key"
                                        rules={[{ required: true, message: "请输入 API Key" }]}
                                      >
                                        <Input.Password placeholder="在蒲公英平台获取 API Key" size="large" />
                                      </Form.Item>
                                    </Col>
                                  </Row>
                                  <Row gutter={16}>
                                    <Col span={12}>
                                      <Form.Item name="publishPassword" label="安装密码（可选）">
                                        <Input.Password placeholder="设置安装密码" size="large" />
                                      </Form.Item>
                                    </Col>
                                  </Row>
                                </>
                              );
                            } else if (platform === 'fir') {
                              return (
                                <Row gutter={16}>
                                  <Col span={24}>
                                    <Form.Item
                                      name="publishApiToken"
                                      label="fir.im API Token"
                                      rules={[{ required: true, message: "请输入 API Token" }]}
                                    >
                                      <Input.Password placeholder="在 fir.im 平台获取 API Token" size="large" />
                                    </Form.Item>
                                  </Col>
                                </Row>
                              );
                            }
                            return null;
                          }}
                        </Form.Item>
                      </>
                    );
                  }}
                </Form.Item>
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item name="publishDescription" label="更新描述（可选）">
                      <Input.TextArea 
                        placeholder="输入本次更新的描述信息" 
                        rows={3}
                        size="large"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </>
            );
          }}
        </Form.Item>
        <Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            icon={<PlayCircleOutlined />} 
            loading={building}
            size="large"
            block
          >
            {building ? "构建中..." : "开始构建"}
          </Button>
        </Form.Item>
      </Form>
      {buildResult && (
        <Collapse
          style={{ marginTop: 20 }}
          activeKey={buildLogCollapsed ? [] : ['build-log']}
          onChange={(keys) => setBuildLogCollapsed(keys.length === 0)}
          items={[
            {
              key: 'build-log',
              label: (
                <span style={{ fontSize: '15px', fontWeight: 800 }}>
                  {buildResult.code === 0 ? "✅ 构建成功" : `❌ 构建失败（退出码 ${buildResult.code}）`}
                </span>
              ),
              children: (
                <pre className="ds-logOutput" style={{ margin: 0, padding: '12px', backgroundColor: 'var(--ds-bg-layout)', borderRadius: '4px' }}>
                  {buildResult.output}
                </pre>
              ),
            },
          ]}
        />
      )}
      {publishing && (
        <Alert
          style={{ marginTop: 20 }}
          type="info"
          showIcon
          message={
            <span style={{ fontSize: '15px', fontWeight: 800 }}>
              📤 正在发布到平台...
            </span>
          }
          description="正在上传 APK 文件，请稍候..."
        />
      )}
      {publishResult && (
        <Alert
          style={{ marginTop: 20 }}
          type={publishResult.success ? "success" : "error"}
          showIcon
          message={
            <span style={{ fontSize: '15px', fontWeight: 800 }}>
              {publishResult.success ? "✅ 发布成功" : `❌ 发布失败`}
            </span>
          }
          description={
            <div>
              <Typography.Text>{publishResult.message}</Typography.Text>
              {publishResult.download_url && (
                <div style={{ marginTop: 8 }}>
                  <Typography.Text strong>下载链接：</Typography.Text>
                  <Typography.Link 
                    onClick={async () => {
                      const url = publishResult.download_url!;
                      try {
                        // 确保 URL 格式正确
                        if (!url.startsWith('http://') && !url.startsWith('https://')) {
                          messageApi.error(`无效的链接格式: ${url}`);
                          return;
                        }
                        await openUrl(url);
                      } catch (e: unknown) {
                        let errorMessage = '未知错误';
                        if (e instanceof Error) {
                          errorMessage = e.message || e.toString();
                        } else if (typeof e === 'string') {
                          errorMessage = e;
                        } else if (e && typeof e === 'object' && 'message' in e) {
                          errorMessage = String((e as { message?: unknown }).message || e);
                        } else {
                          errorMessage = String(e);
                        }
                        messageApi.error(`打开链接失败: ${errorMessage}`);
                        console.error('打开链接失败:', e, 'URL:', url);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {publishResult.download_url}
                  </Typography.Link>
                </div>
              )}
              {publishResult.qr_code_url && (
                <div style={{ marginTop: 8 }}>
                  <Typography.Text strong>二维码：</Typography.Text>
                  <img src={publishResult.qr_code_url} alt="下载二维码" style={{ marginLeft: 8, maxWidth: 100 }} />
                </div>
              )}
            </div>
          }
        />
      )}
    </Card>
  );

  const renderContent = () => {
    if (selectedMenu === "env") return envSection;
    if (selectedMenu === "projects") return projectsSection;
    if (selectedMenu === "publish") return publishSection;
    return buildSection;
  };

  return (
    <ConfigProvider theme={dsTheme}>
      <AntdApp>
        {contextHolder}
        <Layout className="layout">
          <Layout.Sider width={220} className="sider">
            <div className="sider-logo">Android 打包工具</div>
            <Menu
              className="sider-menu"
              mode="inline"
              theme="light"
              selectedKeys={[selectedMenu]}
              onClick={(e) => setSelectedMenu(e.key as typeof selectedMenu)}
              items={[
                { key: "env", label: "环境检测", icon: <ToolOutlined /> },
                { key: "publish", label: "发布配置", icon: <CloudUploadOutlined /> },
                { key: "projects", label: "工程管理", icon: <FolderOutlined /> },
                { key: "build", label: "构建打包", icon: <RocketOutlined /> },
              ]}
            />
          </Layout.Sider>
          <Layout>
            <Layout.Header className="header">
              <Typography.Text className="header-title">
                <span className="ds-headerIcon">
                  {selectedMenu === "env" && <ToolOutlined />}
                  {selectedMenu === "projects" && <FolderOutlined />}
                  {selectedMenu === "build" && <RocketOutlined />}
                  {selectedMenu === "publish" && <CloudUploadOutlined />}
                </span>
                {selectedMenu === "env" && "环境检测"}
                {selectedMenu === "projects" && "工程管理"}
                {selectedMenu === "build" && "构建打包"}
                {selectedMenu === "publish" && "发布配置"}
              </Typography.Text>
            </Layout.Header>
            <Layout.Content className="content">
              <Row gutter={[16, 16]}>
                <Col span={24}>{renderContent()}</Col>
              </Row>
            </Layout.Content>
          </Layout>
        </Layout>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
