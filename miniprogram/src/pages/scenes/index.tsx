import React, { useState } from 'react';
import { View, Text, Switch } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import { callService } from '@/services/ha';
import { ensureSession, useAppStore } from '@/store/app';
import type { HaAutomation, HaScene } from '@/types/ha';
import { errText } from '@/utils/format';
import styles from './index.module.scss';

const SCENE_ICONS = ['🎬', '🌙', '🛡️', '☀️', '🍽️', '📖'];

export default function ScenesPage() {
  const data = useAppStore((s) => s.data);
  const refresh = useAppStore((s) => s.refresh);
  const refreshing = useAppStore((s) => s.refreshing);
  const [busyId, setBusyId] = useState('');

  useDidShow(() => {
    if (ensureSession()) refresh().then((message) => {
      if (message) Taro.showToast({ title: message, icon: 'none' });
    });
  });

  usePullDownRefresh(async () => {
    try {
      const message = await refresh();
      if (message) Taro.showToast({ title: message, icon: 'none' });
    } finally {
      Taro.stopPullDownRefresh();
    }
  });

  const runScene = async (scene: HaScene) => {
    if (busyId) return;
    setBusyId(scene.id);
    console.log('[Scenes] run', scene.id);
    try {
      const res = await callService('scene', 'turn_on', { entity_id: scene.id });
      if (!res.ok) throw new Error(res.error || '场景执行失败');
      Taro.showToast({ title: `已执行「${scene.name}」`, icon: 'none' });
    } catch (err) {
      console.error('[Scenes] run failed', err);
      Taro.showToast({ title: errText(err), icon: 'none', duration: 2500 });
    } finally {
      setBusyId('');
    }
  };

  const toggleAutomation = async (item: HaAutomation, enabled: boolean) => {
    if (busyId) return;
    setBusyId(item.id);
    console.log('[Scenes] automation', item.id, enabled);
    try {
      const res = await callService('automation', enabled ? 'turn_on' : 'turn_off', { entity_id: item.id });
      if (!res.ok) throw new Error(res.error || '自动化设置失败');
      const message = await refresh();
      if (message) throw new Error(message);
    } catch (err) {
      console.error('[Scenes] automation failed', err);
      Taro.showToast({ title: errText(err), icon: 'none', duration: 2500 });
    } finally {
      setBusyId('');
    }
  };

  const scenes = data?.scenes || [];
  const automations = data?.automations || [];

  return (
    <View className={styles.scenesPage}>
      <View className={styles.pageHeader}>
        <Text className={styles.pageTitle}>一键，进入理想生活</Text>
        <Text className={styles.pageSubtitle}>联动家中设备，也可以让自动化替你照料家庭</Text>
      </View>

      <View className={styles.sectionHead}>
        <Text className={styles.sectionTitle}>智能场景</Text>
        <Text className={styles.sectionCount}>{scenes.length} 个场景</Text>
      </View>

      {scenes.length > 0 ? (
        <View className={styles.sceneGrid}>
          {scenes.map((scene, index) => (
            <View key={scene.id} className={styles.sceneItem}>
              <View
                className={classnames(styles.sceneCard, busyId === scene.id && styles.sceneCardBusy)}
                onClick={() => runScene(scene)}
              >
                <View className={styles.sceneTop}>
                  <View className={styles.sceneIcon}>
                    <Text>{SCENE_ICONS[index % SCENE_ICONS.length]}</Text>
                  </View>
                  <View className={styles.sceneArrow}>
                    <Text>{busyId === scene.id ? '…' : '▶'}</Text>
                  </View>
                </View>
                <Text className={styles.sceneName}>{scene.name}</Text>
                <Text className={styles.sceneDesc}>轻点即可执行，多设备状态一步切换</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className={styles.emptyCard}>
          <Text>{refreshing ? '正在读取场景…' : 'HA 中还没有场景，可先在 Home Assistant 中创建'}</Text>
        </View>
      )}

      <View className={styles.sectionHead}>
        <Text className={styles.sectionTitle}>自动化</Text>
        <Text className={styles.sectionCount}>{automations.filter((item) => item.state === 'on').length} 项运行中</Text>
      </View>

      {automations.length > 0 ? (
        <View className={styles.automationCard}>
          {automations.map((item) => (
            <View key={item.id} className={styles.automationRow}>
              <View className={styles.automationInfo}>
                <Text className={styles.automationName}>{item.name}</Text>
                <Text className={classnames(styles.automationState, item.state === 'on' && styles.automationStateOn)}>
                  {item.state === 'on' ? '已启用 · 条件满足时自动执行' : '已停用'}
                </Text>
              </View>
              <Switch
                checked={item.state === 'on'}
                color="#00b3a4"
                disabled={!!busyId}
                onChange={(event) => toggleAutomation(item, event.detail.value)}
              />
            </View>
          ))}
        </View>
      ) : (
        <View className={styles.emptyCard}>
          <Text>{refreshing ? '正在读取自动化…' : 'HA 中还没有自动化规则'}</Text>
        </View>
      )}
    </View>
  );
}
