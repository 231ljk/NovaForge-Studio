import type { PinAssignment } from '../../../shared/types'

interface Props {
  pins: PinAssignment[]
  onChange: (pins: PinAssignment[]) => void
}

export function PinEditor({ pins, onChange }: Props): React.ReactElement {
  const update = (id: string, patch: Partial<PinAssignment>): void => {
    onChange(pins.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const add = (): void => {
    onChange([
      ...pins,
      {
        id: crypto.randomUUID(),
        label: `功能${pins.length + 1}`,
        gpio: pins.length ? Math.min(48, pins[pins.length - 1].gpio + 1) : 4,
        mode: 'output',
        haType: 'switch'
      }
    ])
  }

  return (
    <div className="pin-editor">
      {pins.length === 0 && <div className="muted small">尚未定义引脚功能</div>}
      {pins.map((pin) => (
        <div className="pin-row" key={pin.id}>
          <input
            className="pin-label"
            value={pin.label}
            onChange={(e) => {
              const label = e.target.value.replace(/\s/g, '')
              update(pin.id, {
                label,
                haType: pin.mode === 'output' ? 'switch' : 'binary_sensor'
              })
            }}
            placeholder="功能名"
          />
          <div className="pin-gpio">
            <span>GPIO</span>
            <input
              type="number"
              min={0}
              max={48}
              value={pin.gpio}
              onChange={(e) => update(pin.id, { gpio: Number(e.target.value) })}
            />
          </div>
          <select
            value={pin.mode}
            onChange={(e) =>
              update(pin.id, {
                mode: e.target.value as PinAssignment['mode'],
                haType: e.target.value === 'output' ? 'switch' : 'binary_sensor'
              })
            }
          >
            <option value="output">输出</option>
            <option value="input">输入</option>
          </select>
          <button
            className="icon-btn danger"
            onClick={() => onChange(pins.filter((p) => p.id !== pin.id))}
            title="删除"
          >
            ×
          </button>
        </div>
      ))}
      <button className="btn ghost small full" onClick={add}>
        + 添加引脚功能
      </button>
    </div>
  )
}
