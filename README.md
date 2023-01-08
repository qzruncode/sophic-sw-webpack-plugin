## sophic-sw-webpack-plugin

1. 此插件为sophic而设计，用来生成sw文件，从而使用sophic中的sw缓存模式，存储微应用的静态资源
2. 此插件最好在dark-tunnel脚手架中使用
3. 提供配置项expirationHour用来设置缓存时效，不建议过长

### 安装

```
npm install -D sophic-sw-webpack-plugin
```

### 使用

```
在使用dark-tunnel的项目根目录新建 darkTunnel.config.js

const cachewebWebpackPlugin = require('sophic-sw-webpack-plugin');
module.exports = [
  new cachewebWebpackPlugin({
    expirationHour: 2
  }),
];

在使用dark-tunnel编译项目后，会在build目录下生成sw.js文件
```

### 注册

```
在使用dark-tunnel的项目根目录新建 static/registerSW.js

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js", { scope: '/' })
      .then((registration) => {
        let serviceWorker;
        if (registration.installing) {
          serviceWorker = registration.installing;
        } else if (registration.waiting) {
          serviceWorker = registration.waiting;
        } else if (registration.active) {
          serviceWorker = registration.active;
        }
        if (serviceWorker) {
          serviceWorker.addEventListener("statechange", function (e) {
            console.log("sw的状态改变：" + e.target.state);
          });
        }
      });
    navigator.serviceWorker.onmessage = (e) => {
      console.log("onmessage", e);
      const { data } = e;
      if (data.type === "FetchError") {
        // 请求失败;
      } else if (data.type === "NetWorkError") {
        // 断网
      } else if (data.type === "RefreshClient") {
        // 刷新页面，有新版本的sw安装
        location.reload();
      }
    };
  } else {
    console.log("sw不支持");
  }
}
```