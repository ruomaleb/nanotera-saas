import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEditor } from '../components/Layout'
import { useOrg } from '../hooks/useOrg'
import { Plus, FileText, FileSpreadsheet, FileType, ChevronRight } from 'lucide-react'

interface Template {
  id: string
  nom: string
  type_fichier: string
  usage: string
  description?: string
  champs_fusion?: string[]
  storage_path?: string
  enseignes?: { enseigne: { id: string; nom: string; code_court?: string } }[]
}

const USAGE_LABELS: Record<string, string> = {
  publipostage: 'Publipostage',
  reference: 'Reference',
  import_donnees: 'Import donnees',
  export: 'Export',
}

const USAGE_STYLES: Record<string, string> = {
  publipostage: 'bg-purple-50 text-purple-700',
  reference: 'bg-blue-50 text-blue-700',
  import_donnees: 'bg-amber-50 text-amber-700',
  export: 'bg-emerald-50 text-emerald-700',
}

const FILE_ICONS: Record<string, typeof FileText> = {
  docx: FileText,
  xlsx: FileSpreadsheet,
  pdf: FileType,
}

function TemplateEditor({ template, onSaved }: { template?: Template; onSaved: () => void }) {
  const { org } = useOrg()
  const [nom, setNom] = useState(template?.nom ?? '')
  const [typeFichier, setTypeFichier] = useState(template?.type_fichier ?? 'docx')
  const [usage, setUsage] = useState(template?.usage ?? 'publipostage')
  const [description, setDescription] = useState(template?.description ?? '')
  const [champsFusion, setChampsFusion] = useState(template?.champs_fusion?.join(', ') ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const data = {
      nom,
      type_fichier: typeFichier,
      usage,
      description: description || null,
      champs_fusion: champsFusion ? champsFusion.split(',').map(s => s.trim()).filter(Boolean) : null,
    }
    if (template?.id) {
      await supabase.from('ref_document_templates').update(data).eq('id', template.id)
    } else {
      await supabase.from('ref_document_templates').insert({ ...data, org_id: org?.org_id })
    }
    setSaving(false)
    onSaved()
  }

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-gray-500 block mb-1">Nom du modele</label>
        <input value={nom} onChange={e => setNom(e.target.value)} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Type fichier</label>
          <select value={typeFichier} onChange={e => setTypeFichier(e.target.value)} className={`${inputCls} bg-white`}>
            <option value="docx">Word (.docx)</option>
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="pdf">PDF (.pdf)</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Usage</label>
          <select value={usage} onChange={e => setUsage(e.target.value)} className={`${inputCls} bg-white`}>
            {Object.entries(USAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} className={`${inputCls} h-16 resize-none`} />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Champs de fusion (separes par virgule)</label>
        <input value={champsFusion} onChange={e => setChampsFusion(e.target.value)} className={inputCls}
          placeholder="CodeOperation, NomMagasin, Quantite..." />
        <div className="text-[10px] text-gray-400 mt-1">CamelCase sans accents pour compatibilite OLE DB</div>
      </div>

      {template?.enseignes && template.enseignes.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 block mb-1">Enseignes liees</label>
          <div className="flex flex-wrap gap-1">
            {template.enseignes.map((e: any) => (
              <span key={e.enseigne.id} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                {e.enseigne.code_court ?? e.enseigne.nom}
              </span>
            ))}
          </div>
        </div>
      )}

      <button onClick={handleSave} disabled={saving || !nom.trim()}
        className="w-full py-2 bg-indigo-50 text-indigo-700 text-sm rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors">
        {saving ? 'Enregistrement...' : template?.id ? 'Mettre a jour' : 'Creer le modele'}
      </button>
    </div>
  )
}

export default function Modeles() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const { openEditor, closeEditor } = useEditor()

  const loadData = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('ref_document_templates')
      .select('*, enseignes:jct_template_enseigne(enseigne:ref_enseignes(id, nom, code_court))')
      .order('usage')
      .order('nom')
    setTemplates(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleEdit = (t: Template) => {
    openEditor('Detail modele', <TemplateEditor template={t} onSaved={() => { loadData(); closeEditor() }} />)
  }
  const handleNew = () => {
    openEditor('Nouveau modele', <TemplateEditor onSaved={() => { loadData(); closeEditor() }} />)
  }

  const grouped = Object.groupBy
    ? Object.groupBy(templates, t => t.usage)
    : templates.reduce<Record<string, Template[]>>((acc, t) => {
        (acc[t.usage] ??= []).push(t)
        return acc
      }, {})

  return (
    <div>
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Modeles de documents</h1>
          <p className="text-xs text-gray-400 mt-0.5">{templates.length} modele{templates.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={handleNew} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <Plus size={14} /> Nouveau modele
        </button>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-12">Chargement...</div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([usage, tpls]) => (
              <div key={usage}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${USAGE_STYLES[usage] ?? 'bg-gray-100 text-gray-500'}`}>
                    {USAGE_LABELS[usage] ?? usage}
                  </span>
                  <span className="text-[10px] text-gray-400">{tpls!.length} modele{tpls!.length > 1 ? 's' : ''}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tpls!.map(t => {
                    const Icon = FILE_ICONS[t.type_fichier] ?? FileText
                    return (
                      <button key={t.id} onClick={() => handleEdit(t)}
                        className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-gray-300 transition-colors group flex gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                          <Icon size={18} className="text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[13px] text-gray-900 truncate">{t.nom}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            .{t.type_fichier}
                            {t.champs_fusion && ` · ${t.champs_fusion.length} champs`}
                          </div>
                          {t.enseignes && t.enseignes.length > 0 && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {t.enseignes.map((e: any) => (
                                <span key={e.enseigne.id} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                                  {e.enseigne.code_court ?? e.enseigne.nom}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors self-center" />
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
