import { Editor, loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'

loader.config({ monaco })
;(self as unknown as { MonacoEnvironment: { getWorker: () => Worker } }).MonacoEnvironment = {
  getWorker: () => new EditorWorker()
}

interface Props {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
}

export function CodeEditor({ value, onChange, readOnly }: Props): React.ReactElement {
  return (
    <Editor
      height="100%"
      language="cpp"
      theme="vs-dark"
      value={value}
      onChange={(v) => onChange(v ?? '')}
      loading={<div className="editor-loading">正在加载编辑器…</div>}
      options={{
        readOnly,
        fontSize: 13,
        fontFamily: "'Cascadia Code', Consolas, 'Courier New', monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        tabSize: 2,
        automaticLayout: true,
        padding: { top: 12 },
        renderWhitespace: 'selection'
      }}
    />
  )
}
