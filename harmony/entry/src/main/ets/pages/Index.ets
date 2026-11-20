import { webview } from '@kit.ArkWeb';
import { http } from '@kit.NetworkKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

const TAG: string = 'NovaForge';

/**
 * Web 与 ArkTS 之间的 HTTP 桥。
 * 鸿蒙 Web 组件里页面来自 resource://rawfile，跨域限制比浏览器更严，
 * GitHub 授权与 HA 请求统一交给原生侧代发。
 */
class NovaBridge {
  private controller: webview.WebviewController;

  constructor(controller: webview.WebviewController) {
    this.controller = controller;
  }

  request(id: string, url: string, method: string, headersJson: string, body: string): string {
    const client = http.createHttp();
    let header: Record<string, string> = {};
    try {
      header = JSON.parse(headersJson) as Record<string, string>;
    } catch (err) {
      header = {};
    }
    const options: http.HttpRequestOptions = {
      method: method.toUpperCase() === 'POST' ? http.RequestMethod.POST : http.RequestMethod.GET,
      header: header,
      connectTimeout: 15000,
      readTimeout: 20000,
      expectDataType: http.HttpDataType.STRING
    };
    if (body.length > 0) {
      options.extraData = body;
    }
    client.request(url, options).then((res: http.HttpResponse) => {
      const text: string = typeof res.result === 'string' ? res.result : JSON.stringify(res.result);
      this.controller.runJavaScript(
        `window.__nfDone && window.__nfDone(${JSON.stringify(id)}, ${res.responseCode}, ${JSON.stringify(text)})`
      );
      client.destroy();
    }).catch((err: BusinessError) => {
      this.controller.runJavaScript(
        `window.__nfFail && window.__nfFail(${JSON.stringify(id)}, ${JSON.stringify(err.message)})`
      );
      client.destroy();
    });
    return '';
  }
}

@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController();
  private bridge: NovaBridge = new NovaBridge(this.controller);

  aboutToAppear(): void {
    webview.WebviewController.setWebDebuggingAccess(true);
  }

  onBackPress(): boolean {
    try {
      if (this.controller.accessBackward()) {
        this.controller.backward();
        return true;
      }
    } catch (err) {
      const e = err as BusinessError;
      hilog.warn(0x0000, TAG, 'backward failed %{public}d', e.code);
    }
    return false;
  }

  build() {
    Column() {
      Web({ src: $rawfile('index.html'), controller: this.controller })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .fileAccess(true)
        .onlineImageAccess(true)
        .mixedMode(MixedMode.All)
        .javaScriptProxy({
          object: this.bridge,
          name: 'NovaBridge',
          methodList: ['request'],
          controller: this.controller
        })
        .zoomAccess(false)
        .horizontalScrollBarAccess(false)
        .verticalScrollBarAccess(false)
        .width('100%')
        .height('100%')
    }
    .width('100%')
    .height('100%')
  }
}
