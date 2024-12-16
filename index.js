const axios = require("axios");
const readline = require("readline");
const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");

// 用于缓存上次的 URL、Headers 和 Body 信息的文件路径
const CACHE_FILE = path.resolve(__dirname, "sse-cache.json");

// 初始化事件管理器
const eventEmitter = new EventEmitter();

// 用于创建命令行输入界面
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 辅助函数：读取用户输入
const prompt = (query) => {
  return new Promise((resolve) => rl.question(query, resolve));
};

// SSE 请求逻辑
async function startSSE({ url, headers, body }) {
  console.log("[信息] 正在连接 SSE 服务...");
  console.log(`[URL] ${url}`);
  console.log(`[Headers] ${JSON.stringify(headers)}`);
  console.log(`[Body] ${JSON.stringify(body)}`);

  try {
    // 发送 SSE POST 请求
    const response = await axios.post(url, body, {
      headers,
      responseType: "stream",
    });

    // 处理 SSE 数据流
    response.data.on("data", (chunk) => {
      const message = chunk.toString();
      console.log(`[SSE 消息] ${message}`);
      eventEmitter.emit("message", message); // 可注册监听器处理
    });

    response.data.on("end", () => {
      console.log("[信息] SSE 连接已关闭");
      eventEmitter.emit("end");
      console.log("[信息] 输入 `r` 重新运行上次 SSE 请求，或 `stop` 停止 SSE 请求");
    });

    response.data.on("error", (error) => {
      console.error(`[错误] SSE 出现问题: ${error.message}`);
      eventEmitter.emit("error", error);
    });

    // 监听中断事件，手动关闭 SSE 连接
    eventEmitter.once("stop", () => {
      response.data.destroy(); // 销毁连接
      console.log("[信息] SSE 请求已手动停止");
    });
  } catch (error) {
    console.error(`[错误] SSE 连接失败: ${error.message}`);
    console.log("[信息] 输入 `r` 重新运行上次 SSE 请求，或 `stop` 停止 SSE 请求");
  }
}

// 保存缓存数据到文件
function saveCache(data) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

// 加载缓存数据
function loadCache() {
  if (fs.existsSync(CACHE_FILE)) {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
  }
  return null;
}

// 主程序逻辑
async function main() {
  console.log("欢迎使用 SSE 调试工具！");
  let cache = loadCache(); // 加载缓存

  // 提示用户是否重新使用缓存数据
  if (cache) {
    console.log("[信息] 检测到上次的缓存数据：");
    console.log(`[URL] ${cache.url}`);
    console.log(`[Headers] ${JSON.stringify(cache.headers)}`);
    console.log(`[Body] ${JSON.stringify(cache.body)}`);
    const useCache = await prompt("是否使用缓存数据运行 SSE 请求？(y/n): ");
    if (useCache.toLowerCase() === "y") {
      startSSE(cache);

      // 等待用户输入
      waitForInput(cache);
      return;
    }
  }

  // 获取用户输入
  const url = await prompt("请输入 SSE URL: ");
  const headersInput = await prompt("请输入请求头 (JSON 格式，默认为空): ");
  const bodyInput = await prompt("请输入请求体 (JSON 格式，默认为空): ");

  // 解析请求头和请求体
  let headers = {};
  let body = {};
  try {
    headers = headersInput ? JSON.parse(headersInput) : {};
  } catch (err) {
    console.error("[错误] 请求头格式错误，必须是 JSON 格式！");
    process.exit(1);
  }

  try {
    body = bodyInput ? JSON.parse(bodyInput) : {};
  } catch (err) {
    console.error("[错误] 请求体格式错误，必须是 JSON 格式！");
    process.exit(1);
  }

  // 保存缓存数据
  cache = { url, headers, body };
  saveCache(cache);

  // 启动 SSE
  startSSE(cache);

  // 等待用户输入
  waitForInput(cache);
}

// 等待用户输入操作
function waitForInput(cache) {
  console.log("[信息] 输入 `r` 重新运行上次 SSE 请求，或 `stop` 停止 SSE 请求");

  rl.on("line", (input) => {
    input = input.trim();

    if (input === "r") {
      console.log("[信息] 正在重新运行上次 SSE 请求...");
      startSSE(cache);
    } else if (input === "stop") {
      eventEmitter.emit("stop");
      rl.close();
    } else {
      console.log("[提示] 无效指令！输入 `r` 重新运行或 `stop` 停止 SSE 请求");
    }
  });
}

main();
