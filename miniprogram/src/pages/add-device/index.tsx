import React, { useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classnames from 'classnames';
import { addDevice, scanDevices } from '@/services/ha';
import { ensureSession, useAppStore } from '@/store/app';
import type { ScanDevice } from '@/types/ha';
import { errText } from '@/utils/format';
import styles from './index.module.scss';

export default function AddDevicePage() {
  const refresh = useAppStore((s) => s.refresh);
  const [subnet, setSubnet] = useState('');
  const [devices, setDevices] = useState<ScanDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('留空网段将由 HA 自动检测，也可以输入指定网段');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('80');
  const [token, setToken] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useDidShow(() => {
    ensureSession();
  });

  const startScan = async () => {
    if (scanning) return;
    setScanning(true);
    setDevices([]);
    setError('');
    setScanStatus('正在通过 Home Assistant 搜索局域网设备…');
    console.log('[AddDevice] start network scan');
    try {
      const res = await scanDevices(subnet.trim());
      if (!res.ok) throw new Error(res.error || '局域网搜索不可用');
      const list = (Array.isArray(res.devices) ? res.devices : []) as unknown as ScanDevice[];
      setDevices(list);
      if (typeof res.subnet === 'string' && res.subnet) setSubnet(res.subnet);
      setScanStatus(list.length > 0 ? `发现 ${list.length} 个设备，点击“选择”填入地址` : '暂未发现设备，可在下方手动填写 IP 添加');
    } catch (err) {
      console.error('[AddDevice] scan failed', err);
      setScanStatus(errText(err));
    } finally {
      setScanning(false);
    }
  };

  const manualAdd = async () => {
    if (adding) return;
    const parsedPort = Number(port);
    if (!host.trim()) {
      setError('请填写设备 IP 地址');
      return;
    }
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      setError('端口应为 1–65535 之间的整数');
      return;
    }
    if (!token.trim()) {
      setError('请填写设备控制授权码');
      return;
    }

    setAdding(true);
    setError('');
    console.log('[AddDevice] add device', host.trim(), parsedPort);
    try {
      const res = await addDevice(host.trim(), parsedPort, token.trim());
      if (!res.ok) throw new Error(res.error || '设备添加失败');
      setToken('');
      await refresh();
      Taro.showToast({ title: '设备已接入', icon: 'success' });
      Taro.switchTab({ url: '/pages/home/index' });
    } catch (err) {
      console.error('[AddDevice] add failed', err);
      setError(errText(err));
    } finally {
      setAdding(false);
    }
  };

  return (
    <View className={styles.addPage}>
      <View className={styles.scanHero}>
        <View className={classnames(styles.radar, scanning && styles.radarScanning)}><Text>📡</Text></View>
        <Text className={styles.scanTitle}>{scanning ? '正在搜索附近设备' : '发现你的 NovaForge 设备'}</Text>
        <Text className={styles.scanSubtitle}>确保开发板与 Home Assistant 位于同一局域网，并已完成固件配网</Text>
      </View>

      <View className={styles.card}>
        <Text className={styles.cardTitle}>局域网扫描</Text>
        <Text className={styles.cardDesc}>扫描由 HA 插件执行，无需小程序直接访问手机局域网权限。</Text>
        <Text className={styles.fieldLabel}>扫描网段</Text>
        <Input
          className={styles.fieldInput}
          value={subnet}
          placeholder="留空自动检测，如 192.168.1.0/24"
          placeholderStyle="color:#86909c"
          onInput={(event) => setSubnet(event.detail.value)}
        />
        <View className={classnames(styles.scanButton, scanning && styles.buttonBusy)} onClick={startScan}>
          <Text>{scanning ? '正在扫描，请稍候…' : devices.length > 0 ? '重新扫描' : '开始扫描'}</Text>
        </View>
        <Text className={styles.scanStatus}>{scanStatus}</Text>

        {devices.length > 0 && (
          <View className={styles.resultList}>
            {devices.map((device) => (
              <View key={`${device.name}-${device.host}`} className={styles.resultRow}>
                <View className={styles.resultIcon}><Text>🔌</Text></View>
                <View className={styles.resultInfo}>
                  <Text className={styles.resultName}>{device.name}</Text>
                  <Text className={styles.resultHost}>{device.host} · WiFi</Text>
                </View>
                <View
                  className={styles.pickButton}
                  onClick={() => {
                    setHost(device.host);
                    Taro.showToast({ title: '已填入设备 IP', icon: 'none' });
                  }}
                >
                  <Text>选择</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View className={styles.card}>
        <Text className={styles.cardTitle}>确认并添加</Text>
        <Text className={styles.cardDesc}>选择扫描结果或手动填写地址，再输入固件中显示的控制授权码。</Text>

        <Text className={styles.fieldLabel}>设备地址与端口</Text>
        <View className={styles.portRow}>
          <Input
            className={classnames(styles.fieldInput, styles.hostInput)}
            value={host}
            placeholder="设备 IP，如 192.168.1.66"
            placeholderStyle="color:#86909c"
            onInput={(event) => setHost(event.detail.value)}
          />
          <Input
            className={classnames(styles.fieldInput, styles.portInput)}
            value={port}
            type="number"
            placeholder="端口"
            placeholderStyle="color:#86909c"
            onInput={(event) => setPort(event.detail.value)}
          />
        </View>

        <Text className={styles.fieldLabel}>控制授权码</Text>
        <Input
          className={styles.fieldInput}
          value={token}
          password
          placeholder="请输入设备授权码"
          placeholderStyle="color:#86909c"
          onInput={(event) => setToken(event.detail.value)}
        />
        <Text className={styles.tokenTip}>授权码仅发送给你的 Home Assistant 插件，用于接入设备。</Text>

        {error && <Text className={styles.errorText}>{error}</Text>}
        <View className={classnames(styles.addButton, adding && styles.buttonBusy)} onClick={manualAdd}>
          <Text>{adding ? '正在接入 Home Assistant…' : '添加到我的家庭'}</Text>
        </View>
      </View>

      <View className={styles.helpCard}>
        <Text className={styles.helpTitle}>没有找到设备？</Text>
        <Text className={styles.helpText}>请确认开发板已上电并入网、HA 能访问该网段，且 NovaForge 固件已开启发现服务。也可以直接填写设备 IP 手动添加。</Text>
      </View>
    </View>
  );
}
