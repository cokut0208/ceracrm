// src/components/contract-templates/rich-text-editor.tsx
// TipTap tabanlı Rich Text Editor Component'i (Tablo dahil)

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useEditor, EditorContent, Editor, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { Color } from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import { cn } from '@/lib/utils'; // cn importu

// UI Component Importları
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Link için input
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

// İkon Importları
import {
    Bold as BoldIcon, Italic as ItalicIcon, Underline as UnderlineIcon, Strikethrough,
    Code, Quote, Minus, Heading1, Heading2, Heading3, Heading4,
    List, ListOrdered, WrapText, Pilcrow, // Pilcrow kullanılmıyor
    Link as LinkIcon, Image as ImageIcon, Highlighter, Palette, Unlink, // Unlink eklendi
    Subscript as SubscriptIcon, Superscript as SuperscriptIcon, RotateCcw, RotateCw,
    Table as TableIcon, MinusSquare, Rows, Columns, Trash2, Combine, Split, GripVertical, // GripVertical eklendi
    AlignLeft, AlignCenter, AlignRight, AlignJustify, CodeXml
} from 'lucide-react';

// Props Tipi
interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    characterLimit?: number;
    placeholders?: { label: string; value: string }[];
    disabled?: boolean;
}

// --- Toolbar Butonları İçin Yardımcı Bileşen ---
const ToolbarButton = ({
    editor, command, args = [], activeName, tooltip, Icon, disabled = false, onClickHandler,
}: {
    editor: Editor; command?: string; args?: any[]; activeName?: string | object; tooltip: string; Icon: React.ElementType;
    disabled?: boolean; // Genel disable durumu
    onClickHandler?: () => void;
}) => (
    <TooltipProvider delayDuration={100}>
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onClickHandler ? onClickHandler : () => (editor.chain().focus() as any)[command](...(args || [])).run()}
                    data-state={editor.isActive(typeof activeName === 'object' ? activeName : (activeName || command), args.length > 0 ? args[0] : undefined) ? 'on' : 'off'}
                    className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted data-[state=on]:bg-primary data-[state=on]:text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={disabled || (onClickHandler ? false : (command ? !(editor.can() as any)[command]?.(...(args || [])) : false))}
                    aria-label={tooltip}
                >
                    <Icon className="h-4 w-4" />
                </Button>
            </TooltipTrigger>
            <TooltipContent><p>{tooltip}</p></TooltipContent>
        </Tooltip>
    </TooltipProvider>
);
// ----------------------------------------------------

// ---- Link Düzenleme Balonu ----
const LinkBubbleMenu = ({ editor }: { editor: Editor }) => {
     const [urlInput, setUrlInput] = useState('');

     useEffect(() => {
         // Menü açıldığında mevcut URL'i input'a yükle
         setUrlInput(editor.getAttributes('link').href || '');
     }, [editor, editor.state.selection]); // Seçim değişince de güncellensin

     const handleSetLink = () => {
         const url = urlInput.trim();
         if (url === '') {
             editor.chain().focus().extendMarkRange('link').unsetLink().run();
             return;
         }
         if (!url.startsWith('http://') && !url.startsWith('https://')) {
             alert('Lütfen geçerli bir URL girin (http:// veya https:// ile başlamalı).');
             return;
         }
         editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank' }).run();
     };

     const handleUnsetLink = () => {
         editor.chain().focus().extendMarkRange('link').unsetLink().run();
     };

     return (
         <BubbleMenu editor={editor} tippyOptions={{ duration: 100, placement: 'bottom-start' }} shouldShow={({ editor }) => editor.isActive('link')}>
             <div className="p-2 bg-background border rounded shadow-xl flex items-center gap-2">
                 <Input
                     type="url"
                     placeholder="https://..."
                     value={urlInput}
                     onChange={(e) => setUrlInput(e.target.value)}
                     className="h-8 text-sm"
                     onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSetLink(); } }}
                 />
                 <Button size="sm" className="h-8" onClick={handleSetLink}>Uygula</Button>
                 <Button size="sm" variant="ghost" className="h-8 text-red-500 hover:text-red-600" onClick={handleUnsetLink} title="Linki Kaldır">
                     <Unlink className="h-4 w-4" />
                 </Button>
             </div>
         </BubbleMenu>
     );
};
// --------------------------------

export function RichTextEditor({
    value,
    onChange,
    placeholder = 'İçeriği buraya girin...',
    className = '',
    characterLimit = 30000, // Limiti artırdık
    placeholders = [],
    disabled = false
}: RichTextEditorProps) {

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, history: true, gapcursor: true, codeBlock: false /*CodeBlock kapatıldı*/ }),
            Underline, Subscript, Superscript, Highlight.configure({ multicolor: true }),
            Link.configure({ openOnClick: false, autolink: true, validate: href => /^https?:\/\//.test(href) }),
            Image.configure({ inline: false, allowBase64: true }),
            Placeholder.configure({ placeholder }),
            CharacterCount.configure({ limit: characterLimit }),
            TextAlign.configure({ types: ['heading', 'paragraph', 'listItem', 'image'] }), // Image eklendi
            TextStyle, Color,
            Table.configure({ resizable: true }), TableRow, TableHeader, TableCell,
        ],
        content: value, // Başlangıç içeriği HTML
        onUpdate: ({ editor }) => { onChange(editor.getHTML()); },
        editorProps: { attributes: { class: `prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[400px]`, }, },
        editable: !disabled,
    });

    // Link Ekleme/Düzenleme (Artık BubbleMenu ile handle ediliyor, bu callback eski yöntem)
    // const setLink = useCallback(() => { /* ... */ }, [editor]);

    // Resim Ekleme (URL ile)
    const addImage = useCallback(() => {
        if (!editor) return;
        const url = window.prompt('Resim URL\'si girin:');
        if (url) { if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:image')) { alert('Geçerli URL girin.'); return; } editor.chain().focus().setImage({ src: url }).run(); }
    }, [editor]);

    // Tablo Komutları
    const tableCommands = useMemo(() => ({
        insertTable: () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        addColumnBefore: () => editor?.chain().focus().addColumnBefore().run(), addColumnAfter: () => editor?.chain().focus().addColumnAfter().run(),
        deleteColumn: () => editor?.chain().focus().deleteColumn().run(), addRowBefore: () => editor?.chain().focus().addRowBefore().run(),
        addRowAfter: () => editor?.chain().focus().addRowAfter().run(), deleteRow: () => editor?.chain().focus().deleteRow().run(),
        deleteTable: () => editor?.chain().focus().deleteTable().run(), mergeCells: () => editor?.chain().focus().mergeCells().run(),
        splitCell: () => editor?.chain().focus().splitCell().run(), toggleHeaderColumn: () => editor?.chain().focus().toggleHeaderColumn().run(),
        toggleHeaderRow: () => editor?.chain().focus().toggleHeaderRow().run(),
    }), [editor]);

    const isInTable = editor?.isActive('table') ?? false;

    // Placeholder Ekleme (Toolbar Select'ten)
    const handlePlaceholderInsert = useCallback((placeholderValue: string) => {
        if (editor && placeholderValue) { editor.chain().focus().insertContent(`${placeholderValue}`).run(); }
    }, [editor]);

    if (!editor) { return <div className="p-4 text-center text-muted-foreground border rounded-md min-h-[400px] flex items-center justify-center">Editör yükleniyor...</div>; }

    const chars = editor.storage.characterCount.characters();

    return (
        <div className={`editor-container border rounded-md overflow-hidden flex flex-col ${className}`}>
             {/* Link Düzenleme Balonu */}
             <LinkBubbleMenu editor={editor} />

            {/* Araç Çubuğu */}
            <div className="toolbar bg-muted/50 border-b p-1 flex flex-wrap items-center gap-0.5 shrink-0 sticky top-0 z-10">
                <ToolbarButton editor={editor} command="undo" tooltip="Geri Al" Icon={RotateCcw} disabled={disabled || !editor.can().undo()}/>
                <ToolbarButton editor={editor} command="redo" tooltip="Yinele" Icon={RotateCw} disabled={disabled || !editor.can().redo()}/>
                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Başlık Select */}
                <Select value={ editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : editor.isActive('heading', { level: 4 }) ? 'h4' : 'p' } onValueChange={(value) => { const level = parseInt(value.substring(1)); if (value === 'p') editor.chain().focus().setParagraph().run(); else if (level >= 1 && level <= 4) editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 }).run(); }} disabled={disabled} >
                    <SelectTrigger className="h-8 w-auto sm:w-[100px] text-xs sm:text-sm px-2"><SelectValue placeholder="Stil..." /></SelectTrigger>
                    <SelectContent> <SelectItem value="p">Paragraf</SelectItem> <SelectItem value="h1"><span className="font-bold text-xl">Başlık 1</span></SelectItem> <SelectItem value="h2"><span className="font-bold text-lg">Başlık 2</span></SelectItem> <SelectItem value="h3"><span className="font-bold text-base">Başlık 3</span></SelectItem> <SelectItem value="h4"><span className="font-bold text-sm">Başlık 4</span></SelectItem> </SelectContent>
                </Select>
                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Formatlama Butonları */}
                <ToolbarButton editor={editor} command="toggleBold" activeName="bold" tooltip="Kalın" Icon={BoldIcon} disabled={disabled}/>
                <ToolbarButton editor={editor} command="toggleItalic" activeName="italic" tooltip="İtalik" Icon={ItalicIcon} disabled={disabled}/>
                <ToolbarButton editor={editor} command="toggleUnderline" activeName="underline" tooltip="Altı Çizili" Icon={UnderlineIcon} disabled={disabled}/>
                <ToolbarButton editor={editor} command="toggleStrike" activeName="strike" tooltip="Üstü Çizili" Icon={Strikethrough} disabled={disabled}/>
                <ToolbarButton editor={editor} command="toggleHighlight" activeName="highlight" tooltip="Vurgula" Icon={Highlighter} disabled={disabled}/>
                <ToolbarButton editor={editor} command="toggleSubscript" activeName="subscript" tooltip="Alt Simge" Icon={SubscriptIcon} disabled={disabled}/>
                <ToolbarButton editor={editor} command="toggleSuperscript" activeName="superscript" tooltip="Üst Simge" Icon={SuperscriptIcon} disabled={disabled}/>
                <TooltipProvider><Tooltip><TooltipTrigger asChild>
                    <input type="color" className="h-8 w-8 p-1 border rounded bg-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" onInput={event => editor.chain().focus().setColor((event.target as HTMLInputElement).value).run()} value={editor.getAttributes('textStyle').color || '#000000'} data-testid="setColor" aria-label="Yazı Rengi" disabled={disabled}/>
                </TooltipTrigger><TooltipContent><p>Yazı Rengi</p></TooltipContent></Tooltip></TooltipProvider>
                <ToolbarButton editor={editor} command="unsetColor" tooltip="Rengi Kaldır" Icon={Palette} disabled={disabled} />
                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Hizalama */}
                <ToolbarButton editor={editor} command="setTextAlign" args={['left']} activeName={{ textAlign: 'left' }} tooltip="Sola Hizala" Icon={AlignLeft} disabled={disabled}/>
                <ToolbarButton editor={editor} command="setTextAlign" args={['center']} activeName={{ textAlign: 'center' }} tooltip="Ortala" Icon={AlignCenter} disabled={disabled}/>
                <ToolbarButton editor={editor} command="setTextAlign" args={['right']} activeName={{ textAlign: 'right' }} tooltip="Sağa Hizala" Icon={AlignRight} disabled={disabled}/>
                <ToolbarButton editor={editor} command="setTextAlign" args={['justify']} activeName={{ textAlign: 'justify' }} tooltip="İki Yana Yasla" Icon={AlignJustify} disabled={disabled}/>
                <Separator orientation="vertical" className="h-6 mx-1" />

                 {/* Link ve Resim */}
                 {/* Link butonu artık sadece BubbleMenu'yü açar gibi düşünülebilir veya kaldırılabilir */}
                 <ToolbarButton editor={editor} command="setLink" activeName="link" tooltip="Bağlantı Ekle/Düzenle" Icon={LinkIcon} onClickHandler={() => {/* Bubble menu açılmalı */ alert('Lütfen metin seçip çıkan baloncuktaki linki düzenleyin.');}} disabled={disabled} />
                <ToolbarButton editor={editor} command="setImage" tooltip="Resim Ekle (URL)" Icon={ImageIcon} onClickHandler={addImage} disabled={disabled}/>
                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Listeler ve Bloklar */}
                <ToolbarButton editor={editor} command="toggleBulletList" activeName="bulletList" tooltip="Madde İmli Liste" Icon={List} disabled={disabled}/>
                <ToolbarButton editor={editor} command="toggleOrderedList" activeName="orderedList" tooltip="Numaralı Liste" Icon={ListOrdered} disabled={disabled}/>
                <ToolbarButton editor={editor} command="toggleBlockquote" activeName="blockquote" tooltip="Alıntı" Icon={Quote} disabled={disabled}/>
                <ToolbarButton editor={editor} command="setHorizontalRule" tooltip="Yatay Çizgi" Icon={Minus} disabled={disabled}/>
                <ToolbarButton editor={editor} command="setHardBreak" tooltip="Satır Sonu Ekle" Icon={WrapText} disabled={disabled}/>
                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Tablo Menüsü Popover */}
{/* Tablo Menüsü Popover (insertTable butonu güncellendi) */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 gap-1" data-state={isInTable ? 'on' : 'off'} disabled={disabled}><TableIcon className="h-4 w-4" /><span className="hidden md:inline">Tablo</span></Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1" align="start">
                        <div className="grid grid-cols-3 gap-0.5">
                           {!isInTable ? (
                                // Tablo Ekle Butonu (disabled durumu eklendi)
                                <Button
                                    variant="ghost" size="sm" className="col-span-3 justify-start"
                                    onClick={tableCommands.insertTable}
                                    disabled={!editor.can().insertTable()} // <<<--- YENİ: can() kontrolü
                                >
                                    <TableIcon className="h-4 w-4 mr-2" />Tablo Ekle (3x3)
                                </Button>
                           ) : (
                               <>
                                   {/* Diğer tablo butonları (disabled durumları eklendi) */}
                                   <Button variant="ghost" size="xs" className="justify-start" onClick={tableCommands.addRowBefore} disabled={!editor.can().addRowBefore()}><Rows className="h-3 w-3 mr-1" />Üste Satır</Button>
                                   <Button variant="ghost" size="xs" className="justify-start" onClick={tableCommands.addRowAfter} disabled={!editor.can().addRowAfter()}><Rows className="h-3 w-3 mr-1" />Alta Satır</Button>
                                   <Button variant="ghost" size="xs" className="justify-start text-red-600" onClick={tableCommands.deleteRow} disabled={!editor.can().deleteRow()}><MinusSquare className="h-3 w-3 mr-1" />Satırı Sil</Button>
                                   <Button variant="ghost" size="xs" className="justify-start" onClick={tableCommands.addColumnBefore} disabled={!editor.can().addColumnBefore()}><Columns className="h-3 w-3 mr-1" />Sola Sütun</Button>
                                   <Button variant="ghost" size="xs" className="justify-start" onClick={tableCommands.addColumnAfter} disabled={!editor.can().addColumnAfter()}><Columns className="h-3 w-3 mr-1" />Sağa Sütun</Button>
                                   <Button variant="ghost" size="xs" className="justify-start text-red-600" onClick={tableCommands.deleteColumn} disabled={!editor.can().deleteColumn()}><MinusSquare className="h-3 w-3 mr-1" />Sütunu Sil</Button>
                                   <Separator className="col-span-3 my-1"/>
                                   <Button variant="ghost" size="xs" className="justify-start" onClick={tableCommands.mergeCells} disabled={!editor.can().mergeCells()}><Combine className="h-3 w-3 mr-1"/>Birleştir</Button>
                                   <Button variant="ghost" size="xs" className="justify-start" onClick={tableCommands.splitCell} disabled={!editor.can().splitCell()}><Split className="h-3 w-3 mr-1"/>Ayır</Button>
                                   <Separator className="col-span-3 my-1"/>
                                   <Button variant="ghost" size="xs" className="col-span-3 justify-start text-destructive" onClick={tableCommands.deleteTable} disabled={!editor.can().deleteTable()}><Trash2 className="h-3 w-3 mr-1" />Tabloyu Sil</Button>
                               </>
                           )}
                        </div>
                    </PopoverContent>
                </Popover>
                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Placeholder Insertion Select */}
                {placeholders && placeholders.length > 0 && (
                    <Select onValueChange={handlePlaceholderInsert} disabled={disabled}>
                        <SelectTrigger className="h-8 w-auto sm:w-[150px] text-muted-foreground text-xs sm:text-sm px-2">
                            <CodeXml className="h-4 w-4 mr-1 shrink-0" /><SelectValue placeholder="Alan Ekle..." />
                        </SelectTrigger>
                        <SelectContent>
                            {placeholders.map(p => ( <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem> ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {/* Editör İçerik Alanı */}
            <EditorContent editor={editor} className="editor-content grow overflow-y-auto p-4 focus:outline-none" />

            {/* Karakter Sayacı */}
            {characterLimit && (
                <div className="footer text-xs text-muted-foreground text-right p-1 px-2 border-t shrink-0">
                    {chars}/{characterLimit}
                    {chars > characterLimit && <span className="text-destructive font-medium ml-1">(Limit Aşıldı!)</span>}
                </div>
            )}
        </div>
    );
}