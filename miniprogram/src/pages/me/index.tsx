import React from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { ensureSession, useAppStore } from '@/store/app';
import styles from './index.module.scss';

const PROVIDERS: Record<string, string> = {
  github: 'GitHub 同账号对接',
  gitee: 'Gitee 账号登录',
  email: '邮箱验证码登录',
  demo: '本地演示账号'
};

export default function MePage() {
  const session = useAppStore((s) => s.session);
  const haUrl = useAppStore((s) => s.haUrl);
  const data = useAppStore((s) => s.data);
  const refreshing = useAppStore((s) => s.refreshing);
  const refresh = useAppStore((s) => s.refresh);
  const signOut = useAppStore((s) => s.signOut);

  useDidShow(() => {
    ensureSession();
  });

  const refreshHome = async () => {
    if (refreshing) return;
    const message = await refresh();
    Taro.showToast({ title: message || '家庭数据已更新', icon: message ? 'none' : 'success' });
  };

  const logout = () => {
    Taro.showModal({
      title: '退出登录',
      content: '退出后需要重新授权才能控制家庭设备，确定退出吗？',
      confirmText: '退出',
      confirmColor: '#f53f3f',
      success: (res) => {
        if (!res.confirm) return;
        console.log('[Me] user signed out');
        signOut();
        Taro.reLaunch({ url: '/pages/login/index' });
      }
    });
  };

  const displayName = session?.name || session?.email || 'NovaForge 用户';
  const provider = PROVIDERS[session?.provider || ''] || 'NovaForge 账号';

  return (
    <View className={styles.mePage}>
      <View className={styles.profileCard}>
        <View className={styles.profileMain}>
          <View className={styles.avatar}><Text>{displayName.slice(0, 1).toUpperCase()}</Text></View>
          <View className={styles.profileInfo}>
            <Text className={styles.profileName}>{displayName}</Text>
            <Text className={styles.profileAccount}>{session?.email || '未绑定邮箱'}</Text>
          </View>
        </View>
        <View className={styles.providerBadge}><Text>{provider}</Text></View>
      </View>

      <Text className={styles.sectionTitle}>家庭连接</Text>
      <View className={styles.card}>
        <View className={styles.connectionHead}>
          <View className={styles.connectionIcon}><Text>🏠</Text></View>
          <View className={styles.connectionInfo}>
            <Text className={styles.connectionName}>{data?.name || '我的家庭'}</Text>
            <Text className={styles.connectionUrl}>{session?.demo ? '本地演示数据' : haUrl || '等待连接'}</Text>
          </View>
          <View className={styles.connectedBadge}><Text>{session?.demo ? '演示中' : '已连接'}</Text></View>
        </View>
        <View className={styles.connectionStats}>
          <View className={styles.connectionStat}>
            <Text className={styles.statValue}>{data?.entities.length || 0}</Text>
            <Text className={styles.statLabel}>设备</Text>
          </View>
          <View className={styles.connectionStat}>
            <Text className={styles.statValue}>{data?.scenes.length || 0}</Text>
            <Text className={styles.statLabel}>场景</Text>
          </View>
          <View className={styles.connectionStat}>
            <Text className={styles.statValue}>{data?.automations.length || 0}</Text>
            <Text className={styles.statLabel}>自动化</Text>
          </View>
        </View>
      </View>

      <Text className={styles.sectionTitle}>通用</Text>
      <View className={styles.card}>
        <View className={styles.menuRow} onClick={() => Taro.navigateTo({ url: '/pages/add-device/index' })}>
          <View className={styles.menuIcon}><Text>＋</Text></View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuTitle}>添加设备</Text>
            <Text className={styles.menuDesc}>扫描局域网或手动接入 NovaForge 硬件</Text>
          </View>
          <Text className={styles.menuArrow}>›</Text>
        </View>
        <View className={styles.menuRow} onClick={refreshHome}>
          <View className={styles.menuIcon}><Text>↻</Text></View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuTitle}>{refreshing ? '正在刷新…' : '刷新家庭数据'}</Text>
            <Text className={styles.menuDesc}>同步 HA 中设备、场景与自动化的最新状态</Text>
          </View>
          <Text className={styles.menuArrow}>›</Text>
        </View>
        <View
          className={styles.menuRow}
          onClick={() => Taro.showModal({
            title: '关于 NovaForge',
            content: 'NovaForge 微信小程序通过 HA 插件连接你的智能家居。同账号自动对接，无需在主要登录流程中填写 HA 地址。',
            showCancel: false
          })}
        >
          <View className={styles.menuIcon}><Text>✦</Text></View>
          <View className={styles.menuInfo}>
            <Text className={styles.menuTitle}>关于 NovaForge</Text>
            <Text className={styles.menuDesc}>连接方式与版本信息</Text>
          </View>
          <Text className={styles.menuArrow}>›</Text>
        </View>
      </View>

      <View className={styles.logoutButton} onClick={logout}><Text>退出登录</Text></View>
      <Text className={styles.version}>NovaForge Studio · 微信小程序 1.0.0</Text>
    </View>
  );
}
