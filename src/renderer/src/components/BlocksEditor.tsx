import * as Blockly from 'blockly'
import { useEffect, useRef } from 'react'
import {
  NOVA_TOOLBOX,
  defineNovaBlocks,
  generateArduinoFromWorkspace,
  loadWorkspaceXml,
  saveWorkspaceXml
} from '../lib/blocks'

interface Props {
  projectId: string
  xml: string
  onChangeXml: (xml: string) => void
  onChangeCode: (code: string) => void
}

export function BlocksEditor({ projectId, xml, onChangeXml, onChangeCode }: Props): React.ReactElement {
  const hostRef = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!hostRef.current) return
    defineNovaBlocks()
    const workspace = Blockly.inject(hostRef.current, {
      toolbox: NOVA_TOOLBOX,
      grid: { spacing: 24, length: 3, colour: '#1d2a39', snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.85 },
      move: { scrollbars: true, drag: true, wheel: true }
    })
    workspaceRef.current = workspace
    loadWorkspaceXml(workspace, xml)
    onChangeCode(generateArduinoFromWorkspace(workspace))

    const listener = (): void => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        onChangeXml(saveWorkspaceXml(workspace))
        onChangeCode(generateArduinoFromWorkspace(workspace))
      }, 400)
    }
    workspace.addChangeListener(listener)

    const observer = new ResizeObserver(() => Blockly.svgResize(workspace))
    observer.observe(hostRef.current)
    // 首次注入后布局尺寸可能仍在变化，延迟再校正一次，
    // 否则工具箱坐标错位会导致分类点不开（切换开发板后尤其明显）
    const raf = requestAnimationFrame(() => Blockly.svgResize(workspace))
    const onResize = (): void => Blockly.svgResize(workspace)
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      observer.disconnect()
      if (timerRef.current) window.clearTimeout(timerRef.current)
      workspace.dispose()
      workspaceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  return <div ref={hostRef} className="blockly-host" />
}
