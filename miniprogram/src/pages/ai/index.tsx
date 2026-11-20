import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Input } from '@tarojs/components';
import { useDidShow } from '@tarojs/taro';
import classnames from 'classnames';
import { chat } from '@/services/ha';
import { ensureSession, useAppStore } from '@/store/app';
import { errText } from '@/utils/format';
import styles from './index.module.scss';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTIONS = ['打开客厅灯', '现在温度怎么样', '执行观影模式', '关闭所有灯'];

export default function AiPage() {
  const session = useAppStore((s) => s.session);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [anchor, setAnchor] = useState('message-1');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, role: 'assistant', text: '你好，我是 NovaForge AI 助手。你可以用自然语言查询家庭状态、控制设备或执行场景。' }
  ]);
  const idRef = useRef(1);

  useDidShow(() => {
    ensureSession();
  });

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last) setAnchor(`message-${last.id}`);
  }, [messages, sending]);

  const nextId = () => {
    idRef.current += 1;
    return idRef.current;
  };

  const send = async (preset?: string) => {
    const content = String(preset || input).trim();
    if (!content || sending) return;

    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text: content }]);
    setInput('');
    setSending(true);
    console.log('[AI] send message, length:', content.length);

    try {
      const res = await chat(content);
      if (!res.ok) throw new Error(res.error || 'AI 暂时无法回复');
      const reply = typeof res.reply === 'string' ? res.reply : '指令已处理。';
      setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', text: reply }]);
    } catch (err) {
      console.error('[AI] chat failed', err);
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', text: `这次没有连接成功：${errText(err)}。请检查 HA 连接后重试。` }
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <View className={styles.aiPage}>
      <View className={styles.header}>
        <View className={styles.headerTop}>
          <View className={styles.aiLogo}><Text>✦</Text></View>
          <View className={styles.headerInfo}>
            <Text className={styles.headerTitle}>家庭智能助手</Text>
            <Text className={styles.headerSubtitle}>理解自然语言 · 控制 HA 设备</Text>
          </View>
          <View className={styles.statusDot} />
        </View>
        {session?.demo && <View className={styles.demoTip}><Text>演示模式：回复由本地规则生成</Text></View>}
      </View>

      <ScrollView
        className={styles.messageScroll}
        scrollY
        scrollWithAnimation
        scrollIntoView={anchor}
        showScrollbar={false}
      >
        <View className={styles.welcomeCard}>
          <Text className={styles.welcomeTitle}>试着对我说</Text>
          <Text className={styles.welcomeText}>可以用一句话控制设备、查询状态，或告诉我你准备做什么。</Text>
        </View>

        {messages.map((message) => (
          <View
            id={`message-${message.id}`}
            key={message.id}
            className={classnames(styles.messageRow, message.role === 'user' && styles.messageRowUser)}
          >
            {message.role === 'assistant' && <View className={styles.avatar}><Text>✦</Text></View>}
            <View className={classnames(styles.bubble, message.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant)}>
              <Text>{message.text}</Text>
            </View>
          </View>
        ))}

        {sending && (
          <View className={styles.messageRow}>
            <View className={styles.avatar}><Text>✦</Text></View>
            <View className={classnames(styles.bubble, styles.bubbleAssistant)}>
              <View className={styles.typing}>
                <Text className={styles.typingDots}>•••</Text>
                <Text>正在理解并处理</Text>
              </View>
            </View>
          </View>
        )}
        <View id="message-bottom" />
      </ScrollView>

      <View className={styles.suggestionArea}>
        <Text className={styles.suggestionTitle}>快捷指令</Text>
        <View className={styles.suggestions}>
          {SUGGESTIONS.map((item) => (
            <View key={item} className={styles.suggestion} onClick={() => send(item)}>
              <Text>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className={styles.composer}>
        <View className={styles.inputWrap}>
          <Input
            className={styles.input}
            value={input}
            placeholder="输入设备控制或状态查询…"
            placeholderStyle="color:#86909c"
            confirmType="send"
            onInput={(event) => setInput(event.detail.value)}
            onConfirm={() => send()}
          />
        </View>
        <View
          className={classnames(styles.sendButton, (!input.trim() || sending) && styles.sendDisabled)}
          onClick={() => send()}
        >
          <Text>{sending ? '…' : '发送'}</Text>
        </View>
      </View>
    </View>
  );
}
