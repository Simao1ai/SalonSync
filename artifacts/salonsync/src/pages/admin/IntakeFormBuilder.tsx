import { useState, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListLocations } from "@workspace/api-client-react";
import {
  FileText, Plus, GripVertical, Trash2, Settings, Type, AlignLeft, List, CheckSquare,
  CalendarIcon, PenTool, Upload, ChevronDown, ChevronRight, Eye, Save, Shield, ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function getAuthHeaders(): Record<string, string> {
  const sid = sessionStorage.getItem("__salonsync_dev_sid__");
  return sid ? { Authorization: `Bearer ${sid}` } : {};
}

interface FormField {
  id: string;
  type: "text" | "textarea" | "select" | "checkbox" | "date" | "signature" | "file";
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  helpText?: string;
}

interface IntakeForm {
  id: string;
  name: string;
  description: string | null;
  fields: FormField[];
  isRequired: boolean;
  isActive: boolean;
  hipaaCompliant: boolean;
  locationId: string;
  createdAt: string;
}

const FIELD_TYPES: { type: FormField["type"]; label: string; icon: React.ComponentType<any> }[] = [
  { type: "text", label: "Text", icon: Type },
  { type: "textarea", label: "Long Text", icon: AlignLeft },
  { type: "select", label: "Dropdown", icon: List },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "date", label: "Date", icon: CalendarIcon },
  { type: "signature", label: "Signature", icon: PenTool },
  { type: "file", label: "File Upload", icon: Upload },
];

function SortableField({ field, onUpdate, onRemove }: { field: FormField; onUpdate: (f: FormField) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id });
  const [expanded, setExpanded] = useState(false);
  const style = { transform: CSS.Transform.toString(transform), transition };
  const Icon = FIELD_TYPES.find(t => t.type === field.type)?.icon ?? Type;

  return (
    <div ref={setNodeRef} style={style} className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-white/20 hover:text-white/40">
          <GripVertical className="w-4 h-4" />
        </button>
        <Icon className="w-4 h-4 text-primary shrink-0" />
        <input
          value={field.label}
          onChange={e => onUpdate({ ...field, label: e.target.value })}
          className="flex-1 bg-transparent text-sm font-medium focus:outline-none"
          placeholder="Field label"
        />
        <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded">{field.type}</span>
        {field.required && <span className="text-xs text-primary">Required</span>}
        <button onClick={() => setExpanded(!expanded)} className="text-white/30 hover:text-white/60">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <button onClick={onRemove} className="text-white/20 hover:text-red-400">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-white/[0.04] space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-white/50">Placeholder</label>
              <input
                value={field.placeholder ?? ""}
                onChange={e => onUpdate({ ...field, placeholder: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50">Help Text</label>
              <input
                value={field.helpText ?? ""}
                onChange={e => onUpdate({ ...field, helpText: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={field.required ?? false}
              onChange={e => onUpdate({ ...field, required: e.target.checked })}
              className="w-4 h-4 rounded accent-primary"
            />
            Required field
          </label>
          {field.type === "select" && (
            <div className="space-y-1">
              <label className="text-xs text-white/50">Options (one per line)</label>
              <textarea
                value={(field.options ?? []).join("\n")}
                onChange={e => onUpdate({ ...field, options: e.target.value.split("\n").filter(Boolean) })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none min-h-[80px]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FormBuilder({ form, onBack }: { form?: IntakeForm; onBack: () => void }) {
  const { data: locations } = useListLocations();
  const qc = useQueryClient();
  const [name, setName] = useState(form?.name ?? "");
  const [description, setDescription] = useState(form?.description ?? "");
  const [locationId, setLocationId] = useState(form?.locationId ?? "");
  const [fields, setFields] = useState<FormField[]>(form?.fields ?? []);
  const [isRequired, setIsRequired] = useState(form?.isRequired ?? false);
  const [hipaaCompliant, setHipaaCompliant] = useState(form?.hipaaCompliant ?? false);
  const [preview, setPreview] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { name, description, fields, isRequired, isActive: true, hipaaCompliant, locationId };
      const url = form ? `/api/intake-forms/${form.id}` : "/api/intake-forms";
      const method = form ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Failed to save");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intake-forms"] });
      toast.success(form ? "Form updated" : "Form created");
      onBack();
    },
    onError: () => toast.error("Failed to save form"),
  });

  function addField(type: FormField["type"]) {
    setFields(prev => [...prev, {
      id: crypto.randomUUID(),
      type,
      label: "",
      required: false,
    }]);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFields(prev => {
        const oldIndex = prev.findIndex(f => f.id === active.id);
        const newIndex = prev.findIndex(f => f.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  if (preview) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setPreview(false)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Editor
          </Button>
          <h2 className="text-lg font-semibold">Preview: {name}</h2>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}
            {fields.map(field => (
              <div key={field.id} className="space-y-1.5">
                <label className="text-sm font-medium">
                  {field.label} {field.required && <span className="text-red-400">*</span>}
                </label>
                {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
                {field.type === "text" && (
                  <input disabled placeholder={field.placeholder} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm" />
                )}
                {field.type === "textarea" && (
                  <textarea disabled placeholder={field.placeholder} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm min-h-[80px]" />
                )}
                {field.type === "select" && (
                  <select disabled className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm">
                    <option>{field.placeholder || "Select..."}</option>
                    {field.options?.map(o => <option key={o}>{o}</option>)}
                  </select>
                )}
                {field.type === "checkbox" && (
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled className="w-4 h-4 rounded accent-primary" /> {field.placeholder || field.label}</label>
                )}
                {field.type === "date" && (
                  <input type="date" disabled className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm" />
                )}
                {field.type === "signature" && (
                  <div className="h-32 bg-white/5 border border-white/10 border-dashed rounded-xl flex items-center justify-center text-sm text-muted-foreground">
                    <PenTool className="w-5 h-5 mr-2" /> Signature pad area
                  </div>
                )}
                {field.type === "file" && (
                  <div className="h-20 bg-white/5 border border-white/10 border-dashed rounded-xl flex items-center justify-center text-sm text-muted-foreground">
                    <Upload className="w-5 h-5 mr-2" /> Click to upload or drag & drop
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <h2 className="text-lg font-semibold">{form ? "Edit Form" : "New Intake Form"}</h2>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Form Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/70">Form Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. New Client Intake" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/70">Location</label>
              <select value={locationId} onChange={e => setLocationId(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50">
                <option value="">Select location...</option>
                {(locations ?? []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/70">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Instructions for the client..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[60px]" />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
              Required for new clients
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Shield className="w-4 h-4 text-primary" />
              <input type="checkbox" checked={hipaaCompliant} onChange={e => setHipaaCompliant(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
              HIPAA Compliant
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Form Fields</CardTitle>
            <span className="text-xs text-muted-foreground">{fields.length} field{fields.length !== 1 ? "s" : ""}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {FIELD_TYPES.map(({ type, label, icon: Icon }) => (
              <Button key={type} variant="outline" size="sm" onClick={() => addField(type)} className="gap-1.5 text-xs">
                <Icon className="w-3.5 h-3.5" /> {label}
              </Button>
            ))}
          </div>

          {fields.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No fields yet. Click a field type above to add one.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {fields.map(field => (
                    <SortableField
                      key={field.id}
                      field={field}
                      onUpdate={updated => setFields(prev => prev.map(f => f.id === updated.id ? updated : f))}
                      onRemove={() => setFields(prev => prev.filter(f => f.id !== field.id))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name || !locationId || fields.length === 0} className="gap-2">
          <Save className="w-4 h-4" /> {form ? "Update Form" : "Create Form"}
        </Button>
        <Button variant="outline" onClick={() => setPreview(true)} disabled={fields.length === 0} className="gap-2">
          <Eye className="w-4 h-4" /> Preview
        </Button>
      </div>
    </div>
  );
}

export function IntakeFormBuilder() {
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingForm, setEditingForm] = useState<IntakeForm | undefined>();
  const { data: locations } = useListLocations();
  const qc = useQueryClient();

  const { data: forms, isLoading } = useQuery({
    queryKey: ["intake-forms"],
    queryFn: async () => {
      const r = await fetch("/api/intake-forms", { headers: getAuthHeaders() });
      return r.json() as Promise<IntakeForm[]>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/intake-forms/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intake-forms"] });
      toast.success("Form deleted");
    },
  });

  if (mode === "create" || mode === "edit") {
    return (
      <DashboardLayout>
        <FormBuilder
          form={editingForm}
          onBack={() => { setMode("list"); setEditingForm(undefined); }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Intake Forms</h1>
          <p className="text-muted-foreground mt-1">Create and manage client intake forms</p>
        </div>
        <Button onClick={() => setMode("create")} className="gap-2">
          <Plus className="w-4 h-4" /> New Form
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading forms...</div>
      ) : !forms?.length ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-primary/30" />
            <h3 className="text-lg font-semibold mb-2">No intake forms yet</h3>
            <p className="text-sm text-muted-foreground mb-6">Create your first intake form to collect client information before appointments.</p>
            <Button onClick={() => setMode("create")} className="gap-2">
              <Plus className="w-4 h-4" /> Create Intake Form
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map(form => {
            const loc = (locations ?? []).find((l: any) => l.id === form.locationId);
            return (
              <Card key={form.id} className="group hover:border-primary/20 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-sm">{form.name}</h3>
                    </div>
                    <div className="flex gap-1">
                      {form.hipaaCompliant && (
                        <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Shield className="w-3 h-3" /> HIPAA
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${form.isActive ? "bg-primary/10 text-primary" : "bg-white/5 text-white/30"}`}>
                        {form.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  {form.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{form.description}</p>}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{form.fields.length} fields</span>
                    <span>{loc?.name ?? "Unknown"}</span>
                  </div>
                  <div className="flex gap-2 mt-4 pt-3 border-t border-white/[0.04]">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setEditingForm(form); setMode("edit"); }}
                      className="flex-1 text-xs"
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { if (confirm("Delete this form?")) deleteMutation.mutate(form.id); }}
                      className="text-xs text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
