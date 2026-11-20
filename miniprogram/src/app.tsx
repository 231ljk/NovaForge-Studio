import React, { useEffect } from 'react';
import { useDidShow, useDidHide } from '@tarojs/taro';
import { useAppStore } from '@/store/app';
// 全局样式
import './app.scss';

function App(props) {
  const init = useAppStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  useDidShow(() => {});
  useDidHide(() => {});

  return props.children;
}

export default App;
