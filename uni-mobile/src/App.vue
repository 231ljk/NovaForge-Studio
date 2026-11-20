<script>
import { onLaunch } from '@dcloudio/uni-app'
import * as store from './services/store'

export default {
  onLaunch() {
    store.init()
  }
}
</script>

<style>
page {
  background: #f5f6f7;
  color: #1f2329;
  font-size: 28rpx;
}
</style>
