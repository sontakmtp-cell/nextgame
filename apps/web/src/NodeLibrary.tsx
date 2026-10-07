import { useState } from 'react';
import type { BotDefinition } from '@prompt-chien/contracts';
import { nodeLibrary,nodeUnavailable } from './brain-library.js';
import type { LibraryNode } from './brain-library.js';

export default function NodeLibrary({bot,stateIndex,disabled,onAdd}:{bot:BotDefinition;stateIndex:number;disabled:boolean;onAdd:(node:LibraryNode)=>void}) {
  const [query,setQuery]=useState(''),[group,setGroup]=useState('Tất cả');
  const nodes=nodeLibrary.filter(node=>(group==='Tất cả'||node.group===group)&&`${node.name} ${node.description} ${node.example}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
  return <section className="node-library panel" aria-labelledby="node-library-heading">
    <div className="library-heading"><div><p className="eyebrow">BRAIN LAB / KHÁM PHÁ</p><h2 id="node-library-heading">Thư viện node</h2></div><span>{nodeLibrary.length} mẫu</span></div>
    <p>Mỗi mẫu thêm một luật gồm điều kiện và hành động. Bot đọc luật từ trên xuống; luật đúng đầu tiên được chọn.</p>
    <div className="library-filters">
      <label>Tìm node<input type="search" placeholder="Né đạn, bắn, bộ nhớ…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <label>Nhóm node<select value={group} onChange={e=>setGroup(e.target.value)}>{['Tất cả',...new Set(nodeLibrary.map(node=>node.group))].map(name=><option key={name}>{name}</option>)}</select></label>
    </div>
    <div className="node-library-grid">{nodes.map(node=>{
      const reason=nodeUnavailable(bot,stateIndex,node);
      return <article className="node-library-card" key={node.id}>
        <p className="eyebrow">{node.group}</p><h3>{node.name}</h3><p>{node.description}</p><p className="node-example">{node.example}</p>
        <button disabled={disabled||!!reason} aria-describedby={reason?`node-reason-${node.id}`:undefined} onClick={()=>onAdd(node)} aria-label={`Thêm node ${node.name}`}>+ Thêm vào Brain</button>
        {reason&&<p className="subtle" id={`node-reason-${node.id}`}>{reason}</p>}
      </article>;
    })}</div>
    {!nodes.length&&<p role="status">Không tìm thấy node. Thử từ khác hoặc chọn tất cả nhóm.</p>}
  </section>;
}
