import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import type { HaEntity } from '@/types/ha';
import { iconOf, isOn, isReadonly, stateText } from '@/utils/format';
import styles from './index.module.scss';

interface DeviceCardProps {
  item: HaEntity;
  onPress: (item: HaEntity) => void;
}

export default function DeviceCard({ item, onPress }: DeviceCardProps) {
  const readonly = isReadonly(item);
  const on = isOn(item);
  const value = item.domain === 'sensor' ? `${item.state}${item.unit ? ' ' + item.unit : ''}` : stateText(item.state);

  return (
    <View
      className={classnames(styles.deviceCard, on && !readonly && styles.on, readonly && styles.readonly)}
      onClick={() => {
        if (!readonly) onPress(item);
      }}
    >
      <View className={styles.iconWrap}>
        <Text className={styles.icon}>{iconOf(item)}</Text>
      </View>
      <Text className={styles.name}>{item.name}</Text>
      <Text className={styles.state}>{value}</Text>
    </View>
  );
}
