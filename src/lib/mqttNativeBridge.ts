import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';

export interface MqttBridgeConfig {
  brokerUrl: string;
  username: string;
  password?: string;
  clientId?: string;
  targetDeviceIds?: string[];
  autoReconnect?: boolean;
}

export interface MqttBridgePacketLog {
  id: string;
  direction: 'INCOMING' | 'OUTGOING';
  topic: string;
  timestamp: number;
  summary: string;
  payloadPreview: string;
}

export interface MqttBridgeStatusSnapshot {
  connected: boolean;
  connecting: boolean;
  brokerUrl: string;
  username: string;
  clientId: string;
  subscribedTopics: string[];
  grantedTopics: string[];
  aclDeniedTopics: string[];
  aclWarning?: string;
  connectedSince?: number;
  lastPacketAt?: number;
  lastError?: string;
  receivedCount: number;
  publishedCount: number;
  recentPackets: MqttBridgePacketLog[];
}

function encodeRemainingLength(length: number): Buffer {
  const bytes: number[] = [];
  let x = length;
  do {
    let encodedByte = x % 128;
    x = Math.floor(x / 128);
    if (x > 0) {
      encodedByte = encodedByte | 0x80;
    }
    bytes.push(encodedByte);
  } while (x > 0);
  return Buffer.from(bytes);
}

function encodeUtf8String(str: string): Buffer {
  const strBuf = Buffer.from(str, 'utf8');
  const lenBuf = Buffer.alloc(2);
  lenBuf.writeUInt16BE(strBuf.length, 0);
  return Buffer.concat([lenBuf, strBuf]);
}

function buildConnectPacket(opts: {
  clientId: string;
  username?: string;
  password?: string;
  keepaliveSec?: number;
}): Buffer {
  const protocolName = encodeUtf8String('MQTT');
  const protocolLevel = Buffer.from([0x04]); // MQTT 3.1.1
  let connectFlags = 0x02; // Clean Session = 1
  const payloadParts: Buffer[] = [encodeUtf8String(opts.clientId)];

  if (opts.username) {
    connectFlags |= 0x80;
    payloadParts.push(encodeUtf8String(opts.username));
    if (opts.password) {
      connectFlags |= 0x40;
      payloadParts.push(encodeUtf8String(opts.password));
    }
  }

  const flagsBuf = Buffer.from([connectFlags]);
  const keepaliveBuf = Buffer.alloc(2);
  keepaliveBuf.writeUInt16BE(opts.keepaliveSec ?? 60, 0);

  const variableHeader = Buffer.concat([protocolName, protocolLevel, flagsBuf, keepaliveBuf]);
  const payload = Buffer.concat(payloadParts);
  const remaining = variableHeader.length + payload.length;

  return Buffer.concat([
    Buffer.from([0x10]),
    encodeRemainingLength(remaining),
    variableHeader,
    payload,
  ]);
}

function buildSubscribePacket(packetId: number, topics: string[], qos = 1): Buffer {
  const packetIdBuf = Buffer.alloc(2);
  packetIdBuf.writeUInt16BE(packetId & 0xffff, 0);

  const topicParts: Buffer[] = [];
  for (const t of topics) {
    topicParts.push(encodeUtf8String(t), Buffer.from([qos & 0x03]));
  }
  const payload = Buffer.concat(topicParts);
  const remaining = packetIdBuf.length + payload.length;

  return Buffer.concat([
    Buffer.from([0x82]), // SUBSCRIBE with reserved bits 0010
    encodeRemainingLength(remaining),
    packetIdBuf,
    payload,
  ]);
}

function buildPublishPacket(opts: {
  topic: string;
  payload: string | Buffer;
  qos?: 0 | 1;
  retain?: boolean;
  packetId?: number;
}): Buffer {
  const qos = opts.qos ?? 1;
  const retainBit = opts.retain ? 0x01 : 0x00;
  const qosBits = (qos & 0x03) << 1;
  const firstByte = 0x30 | qosBits | retainBit;

  const topicBuf = encodeUtf8String(opts.topic);
  const packetIdBuf = Buffer.alloc(qos > 0 ? 2 : 0);
  if (qos > 0) {
    packetIdBuf.writeUInt16BE((opts.packetId ?? 1) & 0xffff, 0);
  }
  const payloadBuf =
    typeof opts.payload === 'string' ? Buffer.from(opts.payload, 'utf8') : opts.payload;

  const remaining = topicBuf.length + packetIdBuf.length + payloadBuf.length;
  return Buffer.concat([
    Buffer.from([firstByte]),
    encodeRemainingLength(remaining),
    topicBuf,
    packetIdBuf,
    payloadBuf,
  ]);
}

function buildPubAckPacket(packetId: number): Buffer {
  const buf = Buffer.alloc(4);
  buf[0] = 0x40; // PUBACK
  buf[1] = 0x02;
  buf.writeUInt16BE(packetId & 0xffff, 2);
  return buf;
}

export class BugzNativeMqttBridge {
  private socket: net.Socket | tls.TLSSocket | null = null;
  private rxBuffer: Buffer = Buffer.alloc(0);
  private pingTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private nextPacketId = 1;
  private manualStop = false;

  private connected = false;
  private connecting = false;
  private config: MqttBridgeConfig;
  private clientId: string;
  private subscribedTopics: string[] = [];
  private grantedTopics: string[] = [];
  private aclDeniedTopics: string[] = [];
  private pendingSubByPacketId: Map<number, string[]> = new Map();
  private aclWarning?: string;
  private connectedSince?: number;
  private lastPacketAt?: number;
  private lastError?: string;
  private receivedCount = 0;
  private publishedCount = 0;
  private recentPackets: MqttBridgePacketLog[] = [];

  private onIncomingMessage?: (params: {
    topic: string;
    payload: Record<string, unknown>;
    rawText: string;
  }) => void | Promise<void>;

  constructor(
    initialConfig: MqttBridgeConfig,
    onIncomingMessage?: (params: {
      topic: string;
      payload: Record<string, unknown>;
      rawText: string;
    }) => void | Promise<void>
  ) {
    this.config = initialConfig;
    this.clientId =
      initialConfig.clientId ||
      `bugz-backend-bridge-${crypto.randomBytes(3).toString('hex')}`;
    this.onIncomingMessage = onIncomingMessage;
  }

  public getStatus(): MqttBridgeStatusSnapshot {
    return {
      connected: this.connected,
      connecting: this.connecting,
      brokerUrl: this.config.brokerUrl,
      username: this.config.username,
      clientId: this.clientId,
      subscribedTopics: [...this.subscribedTopics],
      grantedTopics: [...this.grantedTopics],
      aclDeniedTopics: [...this.aclDeniedTopics],
      aclWarning: this.aclWarning,
      connectedSince: this.connectedSince,
      lastError: this.lastError,
      lastPacketAt: this.lastPacketAt,
      receivedCount: this.receivedCount,
      publishedCount: this.publishedCount,
      recentPackets: [...this.recentPackets],
    };
  }

  private recordPacket(
    direction: 'INCOMING' | 'OUTGOING',
    topic: string,
    rawText: string,
    summary: string
  ) {
    this.lastPacketAt = Date.now();
    this.recentPackets.unshift({
      id: `pkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      direction,
      topic,
      timestamp: this.lastPacketAt,
      summary,
      payloadPreview: rawText.slice(0, 260),
    });
    if (this.recentPackets.length > 40) {
      this.recentPackets.length = 40;
    }
  }

  private allocPacketId(): number {
    this.nextPacketId = (this.nextPacketId % 65000) + 1;
    return this.nextPacketId;
  }

  public updateConfigAndConnect(nextConfig: Partial<MqttBridgeConfig>): void {
    this.config = {
      ...this.config,
      ...nextConfig,
    };
    if (nextConfig.clientId) {
      this.clientId = nextConfig.clientId;
    }
    this.disconnect();
    this.manualStop = false;
    this.connect();
  }

  public addDeviceSubscription(deviceId: string): void {
    const clean = deviceId.trim();
    if (!clean) return;
    const currentTargets = new Set(this.config.targetDeviceIds || ['robot01']);
    currentTargets.add(clean);
    this.config.targetDeviceIds = Array.from(currentTargets);

    if (this.connected && this.socket && !this.socket.destroyed) {
      const topics = [
        `bugz/v1/devices/${clean}/observations`,
        `bugz/v1/devices/${clean}/presence`,
        `bugz/v1/devices/${clean}/acks`,
      ];
      for (const t of topics) {
        if (!this.subscribedTopics.includes(t)) {
          const pktId = this.allocPacketId();
          this.pendingSubByPacketId.set(pktId, [t]);
          this.socket.write(buildSubscribePacket(pktId, [t], 1));
          this.subscribedTopics.push(t);
        }
      }
    }
  }

  public connect(): void {
    if (this.connected || this.connecting) return;
    const rawUrl = (this.config.brokerUrl || '').trim();
    if (!rawUrl || (!rawUrl.startsWith('mqtts://') && !rawUrl.startsWith('mqtt://'))) {
      this.lastError =
        'Chưa cấu hình MQTT_BROKER_URL hợp lệ (yêu cầu mqtts://<host>:8883 hoặc mqtt://<host>:1883).';
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      this.lastError = `URL MQTT Broker không hợp lệ: ${rawUrl}`;
      return;
    }

    const isTls = parsed.protocol === 'mqtts:';
    const host = parsed.hostname;
    const port = Number(parsed.port) || (isTls ? 8883 : 1883);

    this.connecting = true;
    this.lastError = undefined;
    this.rxBuffer = Buffer.alloc(0);

    const onSocketConnected = () => {
      if (!this.socket || this.socket.destroyed) return;
      const connectPkt = buildConnectPacket({
        clientId: this.clientId,
        username: this.config.username || undefined,
        password: this.config.password || undefined,
        keepaliveSec: 60,
      });
      this.socket.write(connectPkt);
    };

    const socket = isTls
      ? tls.connect(
          {
            host,
            port,
            servername: host,
            rejectUnauthorized: true,
          },
          onSocketConnected
        )
      : net.connect({ host, port }, onSocketConnected);

    this.socket = socket;

    socket.on('data', (chunk: Buffer) => {
      this.rxBuffer = Buffer.concat([this.rxBuffer, chunk]);
      this.processRxBuffer();
    });

    socket.on('error', (err: Error) => {
      this.lastError = `Lỗi socket MQTT (${host}:${port}): ${err.message}`;
      this.connected = false;
      this.connecting = false;
    });

    socket.on('close', () => {
      this.connected = false;
      this.connecting = false;
      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      if (!this.manualStop && this.config.autoReconnect !== false) {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          this.connect();
        }, 5000);
      }
    });
  }

  public disconnect(): void {
    this.manualStop = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.write(Buffer.from([0xe0, 0x00])); // DISCONNECT
        this.socket.destroy();
      } catch {
        // Ignore
      }
      this.socket = null;
    }
    this.connected = false;
    this.connecting = false;
  }

  private processRxBuffer(): void {
    while (this.rxBuffer.length >= 2) {
      const byte0 = this.rxBuffer[0];
      const packetType = byte0 >> 4;

      // Decode remaining length
      let multiplier = 1;
      let remainingLength = 0;
      let offset = 1;
      let encodedByte = 0;
      do {
        if (offset >= this.rxBuffer.length) {
          // Wait for more bytes
          return;
        }
        encodedByte = this.rxBuffer[offset++];
        remainingLength += (encodedByte & 127) * multiplier;
        multiplier *= 128;
      } while ((encodedByte & 128) !== 0);

      const totalPacketLength = offset + remainingLength;
      if (this.rxBuffer.length < totalPacketLength) {
        // Wait for full packet frame
        return;
      }

      const body = this.rxBuffer.subarray(offset, totalPacketLength);
      this.rxBuffer = this.rxBuffer.subarray(totalPacketLength);

      this.handleMqttPacket(byte0, packetType, body);
    }
  }

  private handleMqttPacket(byte0: number, packetType: number, body: Buffer): void {
    if (packetType === 2) {
      // CONNACK
      const returnCode = body.length >= 2 ? body[1] : 255;
      if (returnCode === 0) {
        this.connected = true;
        this.connecting = false;
        this.connectedSince = Date.now();
        this.lastError = undefined;
        this.aclWarning = undefined;
        this.grantedTopics = [];
        this.aclDeniedTopics = [];
        this.pendingSubByPacketId.clear();

        // Subscribe to explicit target devices first (e.g. robot01) so even strict single-device ACLs succeed
        const targetDevices = Array.from(
          new Set([...(this.config.targetDeviceIds || []), 'robot01'])
        );
        this.subscribedTopics = [];
        for (const devId of targetDevices) {
          const devTopics = [
            `bugz/v1/devices/${devId}/observations`,
            `bugz/v1/devices/${devId}/presence`,
            `bugz/v1/devices/${devId}/acks`,
          ];
          for (const t of devTopics) {
            const pktId = this.allocPacketId();
            this.pendingSubByPacketId.set(pktId, [t]);
            this.socket?.write(buildSubscribePacket(pktId, [t], 1));
            this.subscribedTopics.push(t);
          }
        }

        // Start keepalive PINGREQ every 25s
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
          if (this.connected && this.socket && !this.socket.destroyed) {
            this.socket.write(Buffer.from([0xc0, 0x00]));
          }
        }, 25_000);
      } else {
        this.connected = false;
        this.connecting = false;
        this.lastError = `Broker từ chối kết nối CONNACK (returnCode=${returnCode}). Kiểm tra username/password.`;
        this.socket?.destroy();
      }
      return;
    }

    if (packetType === 9) {
      // SUBACK
      if (body.length < 3) return;
      const packetId = body.readUInt16BE(0);
      const topics = this.pendingSubByPacketId.get(packetId) || [];
      this.pendingSubByPacketId.delete(packetId);
      for (let i = 0; i < topics.length && 2 + i < body.length; i++) {
        const rc = body[2 + i];
        const topic = topics[i];
        if (rc === 0x80) {
          if (!this.aclDeniedTopics.includes(topic)) {
            this.aclDeniedTopics.push(topic);
          }
        } else {
          if (!this.grantedTopics.includes(topic)) {
            this.grantedTopics.push(topic);
          }
        }
      }
      if (this.aclDeniedTopics.length > 0) {
        this.aclWarning = `EMQX Broker đang chặn quyền SUBSCRIBE (SUBACK=0x80) của tài khoản "${this.config.username}" trên ${this.aclDeniedTopics.length} topic (${this.aclDeniedTopics.join(', ')}). Nguyên nhân: trên EMQX Cloud -> Access Control -> Authorization, user "${this.config.username}" mới chỉ có quyền Publish lên observations/presence/acks mà chưa có quyền Subscribe. Hãy đổi Action thành "Pub/Sub" (All) cho topic "bugz/v1/devices/robot01/#" trên EMQX Cloud, hoặc nhập tài khoản MQTT có quyền đọc tại bảng cấu hình bên dưới.`;
      }
      return;
    }

    if (packetType === 3) {
      // PUBLISH from Broker
      if (body.length < 2) return;
      const qos = (byte0 >> 1) & 0x03;
      const topicLen = body.readUInt16BE(0);
      let cursor = 2;
      if (body.length < cursor + topicLen) return;
      const topic = body.subarray(cursor, cursor + topicLen).toString('utf8');
      cursor += topicLen;

      let packetId = 0;
      if (qos > 0) {
        if (body.length < cursor + 2) return;
        packetId = body.readUInt16BE(cursor);
        cursor += 2;
      }

      const payloadBuf = body.subarray(cursor);
      const rawText = payloadBuf.toString('utf8');

      // Immediately acknowledge QoS 1
      if (qos === 1 && this.socket && !this.socket.destroyed) {
        this.socket.write(buildPubAckPacket(packetId));
      }

      this.receivedCount += 1;
      try {
        const parsedObj = JSON.parse(rawText) as Record<string, unknown>;
        const postureOrStatus =
          typeof parsedObj.posture === 'string'
            ? `posture=${parsedObj.posture} (${Math.round(Number(parsedObj.confidence || 0) * 100)}%)`
            : typeof parsedObj.status === 'string'
            ? `status=${parsedObj.status}`
            : typeof parsedObj.command_id === 'string'
            ? `ACK cmd=${parsedObj.command_id} active=${String(parsedObj.monitoring_active)}`
            : 'JSON packet';
        this.recordPacket('INCOMING', topic, rawText, postureOrStatus);

        if (this.onIncomingMessage) {
          void Promise.resolve(
            this.onIncomingMessage({
              topic,
              payload: parsedObj,
              rawText,
            })
          ).catch(() => {});
        }
      } catch {
        this.recordPacket('INCOMING', topic, rawText, 'Non-JSON payload');
      }
      return;
    }

    if (packetType === 9) {
      // SUBACK
      if (body.length >= 2) {
        const subPacketId = body.readUInt16BE(0);
        const returnCodes = Array.from(body.subarray(2));
        for (const code of returnCodes) {
          if (code === 0x80) {
            console.warn(`[MQTT Bridge] SUBACK packet #${subPacketId}: 1 topic bị Broker ACL từ chối (code 0x80).`);
          }
        }
      }
      return;
    }
  }

  public publishCommandToDevice(
    deviceId: string,
    commandPayload: Record<string, unknown>
  ): {
    ok: boolean;
    topic: string;
    message: string;
  } {
    const topic = `bugz/v1/devices/${deviceId}/commands`;
    const rawText = JSON.stringify(commandPayload);

    if (!this.connected || !this.socket || this.socket.destroyed) {
      return {
        ok: false,
        topic,
        message: `MQTT Bridge chưa kết nối tới broker (${this.config.brokerUrl || 'chưa cấu hình'}). Lệnh đã lưu hàng đợi command_jobs chờ Robot kết nối.`,
      };
    }

    try {
      const pkt = buildPublishPacket({
        topic,
        payload: rawText,
        qos: 1,
        retain: false,
        packetId: this.allocPacketId(),
      });
      this.socket.write(pkt);
      this.publishedCount += 1;
      this.recordPacket(
        'OUTGOING',
        topic,
        rawText,
        `CMD ${String(commandPayload.command_id || '')} session=${String(
          commandPayload.session_id || ''
        )} monitoring=${String(commandPayload.monitoring_enabled)}`
      );
      return {
        ok: true,
        topic,
        message: `Đã publish lệnh monitoring.set trực tiếp xuống ${topic} qua MQTT TLS Bridge (QoS 1, retain=false).`,
      };
    } catch (err) {
      return {
        ok: false,
        topic,
        message: err instanceof Error ? err.message : 'Lỗi khi ghi gói PUBLISH xuống MQTT socket.',
      };
    }
  }
}
