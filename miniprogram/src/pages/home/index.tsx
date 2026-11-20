import React, { useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import DeviceCard from '@/components/DeviceCard';
import { callService } from '@/services/ha';
import { ensureSession, useAppStore } from '@/store/app';
import type { HaEntity } from '@/types/ha';
import { errText, greeting, isOn } from '@/utils/format';
import styles from './index.module.scss';

export default function HomePage() {
  const session = useAppStore((s) => s.session);
  const ready = useAppStore((s) => s.ready);
  const data = useAppStore((s) => s.data);
  const refreshing = useAppStore((s) => s.refreshing);
  const refresh = useAppStore((s) => s.refresh);
  const [busyId, setBusyId] = useState('');

  const showRefreshError = (message?: string) => {
    if (message) Taro.showToast({ title: message, icon: 'none', duration: 2500 });
  };

  useDidShow(() => {
    if (ensureSession()) refresh().then(showRefreshError);
  });

  usePullDownRefresh(async () => {
    try {
      showRefreshError(await refresh());
    } finally {
      Taro.stopPullDownRefresh();
    }
  });

  const control = async (item: HaEntity) => {
    if (busyId) return;
    let domain = item.domain;
    let service = isOn(item) ? 'turn_off' : 'turn_on';

    if (item.domain === 'lock') service = item.state === 'locked' ? 'unlock' : 'lock';
    else if (item.domain === 'cover') service = item.state === 'open' ? 'close_cover' : 'open_cover';
    else if (item.domain === 'button') service = 'press';
    else if (item.domain === 'scene' || item.domain === 'script') service = 'turn_on';

    setBusyId(item.id);
    console.log('[Home] control', item.id, domain, service);
    try {
      const res = await callService(domain, service, { entity_id: item.id });
      if (!res.ok) throw new Error(res.error || '设备控制失败');
      await refresh();
    } catch (err) {
      console.error('[Home] control failed', err);
      Taro.showToast({ title: errText(err), icon: 'none', duration: 2500 });
    } finally {
      setBusyId('');
    }
  };

  const entities = data?.entities || [];
  const onlineCount = entities.filter((item) => item.state !== 'unavailable').length;
  const activeCount = entities.filter((item) => isOn(item)).length;
  const displayName = session?.name || session?.email || '家庭成员';

  if (ready && !session) {
    return (
      <View className={styles.loadingCard}>
        <Text className={styles.loadingText}>正在进入登录页…</Text>
      </View>
    );
  }

  return (
    <View className={styles.homePage}>
      <View className={styles.hero}>
        <View className={styles.heroTop}>
          <View>
            <Text className={styles.greeting}>{greeting()}，{displayName}</Text>
            <Text className={styles.heroTitle}>让家更懂你</Text>
          </View>
          <View
            className={styles.addButton}
            onClick={() => Taro.navigateTo({ url: '/pages/add-device/index' })}
          >
            <Text className={styles.addIcon}>＋</Text>
          </View>
        </View>
      </View>

      <View className={styles.content}>
        {session?.demo && (
          <View className={styles.demoBanner}>
            <Text>当前为演示模式，设备数据保存在本地，可直接体验控制交互。</Text>
          </View>
        )}

        <View className={styles.overview}>
          <View className={styles.overviewHead}>
            <Text className={styles.homeName}>{data?.name || '我的家庭'}</Text>
            <View className={styles.onlineBadge}>
              <View className={styles.onlineDot} />
              <Text>{session?.demo ? '演示家庭' : 'HA 已连接'}</Text>
            </View>
          </View>
          <View className={styles.stats}>
            <View className={styles.statItem}>
              <Text className={styles.statValue}>{entities.length}</Text>
              <Text className={styles.statLabel}>全部设备</Text>
            </View>
            <View className={styles.statItem}>
              <Text className={styles.statValue}>{activeCount}</Text>
              <Text className={styles.statLabel}>正在运行</Text>
            </View>
            <View className={styles.statItem}>
              <Text className={styles.statValue}>{onlineCount}</Text>
              <Text className={styles.statLabel}>在线设备</Text>
            </View>
          </View>
        </View>

        <View className={styles.sectionHead}>
          <Text className={styles.sectionTitle}>我的设备</Text>
          <Text className={styles.sectionTip}>{refreshing ? '正在更新…' : '点按卡片即可控制'}</Text>
        </View>

        {entities.length > 0 ? (
          <View className={styles.deviceGrid}>
            {entities.map((item) => (
              <View
                key={item.id}
                className={classnames(styles.gridItem, busyId === item.id && styles.gridItemBusy)}
              >
                <DeviceCard item={item} onPress={control} />
              </View>
            ))}
          </View>
        ) : (
          <View className={styles.emptyCard}>
            <Text className={styles.emptyIcon}>{refreshing ? '⏳' : '🏠'}</Text>
            <Text className={styles.emptyTitle}>{refreshing ? '正在同步家庭设备' : '还没有可控设备'}</Text>
            <Text className={styles.emptyText}>
              {refreshing ? '正在从 Home Assistant 读取最新状态…' : '点击右上角加号，扫描并添加 NovaForge 设备'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
