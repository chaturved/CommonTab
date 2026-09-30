const root = document.querySelector('#app');
const nav = document.querySelector('#nav');
const toast = document.querySelector('#toast');
const state = { token: sessionStorage.getItem('splittip.token'), me: null, groups: [], group: null };
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const money = (minor, code) => new Intl.NumberFormat(undefined, {style:'currency', currency:code}).format(minor / (['JPY','KRW','CLP'].includes(code) ? 1 : ['BHD','KWD','OMR','TND'].includes(code) ? 1000 : 100));
const digitsFor = code => ['JPY','KRW','CLP'].includes(code) ? 0 : ['BHD','KWD','OMR','TND'].includes(code) ? 3 : 2;
const units = (value, code) => {
  const text=String(value).trim();
  const digits=digitsFor(code);
  if (!/^\d+(\.\d+)?$/.test(text)) throw Error('Enter a valid amount.');
  const [whole, fraction='']=text.split('.');
  if (fraction.length>digits) throw Error(`This currency supports ${digits} decimal places.`);
  const amount=BigInt(whole)*10n**BigInt(digits)+BigInt((fraction.padEnd(digits,'0'))||'0');
  if(amount<=0n || amount>100000000000n) throw Error('Amount is outside the supported range.');
  return Number(amount);
};
function error(message) { toast.textContent = message; toast.style.display='block'; setTimeout(() => toast.style.display='none', 5000); }
async function api(path, options={}) {
  const headers = {'Accept':'application/json', ...(state.token ? {'Authorization':`Bearer ${state.token}`} : {}), ...(options.headers || {})};
  if (options.body && typeof options.body !== 'string' && !(options.body instanceof Blob)) {
    headers['Content-Type']='application/json'; options.body=JSON.stringify(options.body);
  }
  const response = await fetch(`/v1/${path}`, {...options, headers});
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    if (response.status===401 && state.token) { sessionStorage.removeItem('splittip.token'); state.token=null; renderAuth(); }
    throw Error(detail.detail || `Request failed (${response.status})`);
  }
  if (response.status===204) return null;
  return response.headers.get('content-type')?.includes('json') ? response.json() : response.blob();
}
function dialog(content, onOpen) {
  const element=document.createElement('dialog'); element.innerHTML=content; document.body.append(element);
  element.addEventListener('close', () => element.remove());
  element.querySelectorAll('[data-close]').forEach(button => button.onclick=() => element.close());
  element.showModal(); onOpen?.(element); return element;
}
function formData(form) { return Object.fromEntries(new FormData(form).entries()); }
function bind(form, action) {
  form.addEventListener('submit', async event => {
    event.preventDefault(); const submit=form.querySelector('[type=submit]'); submit.disabled=true;
    try { await action(formData(form), form); } catch (cause) { error(cause.message); } finally { submit.disabled=false; }
  });
}
function renderAuth() {
  nav.innerHTML='';
  root.innerHTML=`<div class="card" style="max-width:480px;margin:4rem auto"><h1>Share the whole bill</h1><p class="muted">Create groups, track balances, and keep receipts together.</p>
    <form id="auth"><label>Email<input name="email" type="email" autocomplete="email" required></label>
    <label id="name-label" hidden>Name<input name="name" autocomplete="name"></label>
    <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
    <button type="submit">Sign in</button></form><p><button class="secondary" id="switch">Create an account</button></p></div>`;
  let register=false;
  document.querySelector('#switch').onclick=() => {
    register=!register;
    document.querySelector('#name-label').hidden=!register;
    document.querySelector('[name=name]').required=register;
    document.querySelector('#auth [type=submit]').textContent=register?'Create account':'Sign in';
    document.querySelector('#switch').textContent=register?'I already have an account':'Create an account';
  };
  bind(document.querySelector('#auth'), async values => {
    const path=register?'accounts':'auth/sessions';
    const session=await api(path,{method:'POST',body:register?values:{email:values.email,password:values.password}});
    state.token=session.accessToken; state.me=session.user; sessionStorage.setItem('splittip.token',state.token);
    await refresh();
  });
}
function renderGroups() {
  state.group=null;
  nav.innerHTML=`<button id="signout">Sign out</button>`;
  document.querySelector('#signout').onclick=async () => {
    try { await api('auth/sessions',{method:'DELETE'}); } catch {};
    sessionStorage.removeItem('splittip.token'); state.token=null; state.me=null; renderAuth();
  };
  root.innerHTML=`<div class="row"><div><h1>Groups</h1><p class="muted">Signed in as ${esc(state.me?.name)}</p></div>
    <div class="actions"><button id="new-group">New group</button><button class="secondary" id="join">Join with code</button></div></div>
    <div class="grid" id="groups">${state.groups.length ? state.groups.map(group => `<button class="card" data-group="${esc(group.id)}" style="text-align:left;color:inherit;background:white"><h2>${esc(group.name)}</h2><p class="muted">${group.members.length} members · ${esc(group.currencyCode)}</p></button>`).join('') : '<div class="card"><h2>No groups yet</h2><p>Create a group or join with an invitation code.</p></div>'}</div>`;
  document.querySelectorAll('[data-group]').forEach(button => button.onclick=() => openGroup(button.dataset.group));
  document.querySelector('#new-group').onclick=() => {
    const modal=dialog(`<h2>Create group</h2><form><label>Name<input name="name" required maxlength="120"></label><label>Currency<select name="currencyCode">${["USD","EUR","GBP","CAD","AUD","JPY","INR"].map(code=>`<option value="${code}">${code}</option>`).join("")}</select></label><div class="actions"><button type="submit">Create</button><button type="button" class="secondary" data-close>Cancel</button></div></form>`);
    bind(modal.querySelector('form'),async values => { const group=await api('groups',{method:'POST',body:{name:values.name,currencyCode:values.currencyCode.toUpperCase()}}); modal.close(); await refresh(); await openGroup(group.id); });
  };
  document.querySelector('#join').onclick=() => {
    const modal=dialog(`<h2>Join group</h2><form><label>Invitation code<input name="inviteToken" required></label><div class="actions"><button type="submit">Join</button><button type="button" class="secondary" data-close>Cancel</button></div></form>`);
    bind(modal.querySelector('form'), async values => { const group=await api('invitations/accept',{method:'POST',body:values}); modal.close(); await refresh(); await openGroup(group.id); });
  };
}
async function refresh() {
  if (!state.token) return renderAuth();
  try { state.me=await api('me'); state.groups=await api('groups'); renderGroups(); }
  catch (cause) { error(cause.message); if (!state.token) renderAuth(); }
}
async function openGroup(id) {
  try { state.group=await api(`groups/${id}`); renderGroup(); } catch(cause) { error(cause.message); }
}
function member(id) { return state.group?.members.find(person => person.id===id)?.name || 'Member'; }
function renderGroup() {
  const group=state.group; if (!group) return;
  nav.innerHTML=`<button id="back">Groups</button>`;
  document.querySelector('#back').onclick=renderGroups;
  root.innerHTML=`<div class="row"><div><h1>${esc(group.name)}</h1><p class="muted">${group.members.length} members · ${esc(group.currencyCode)}</p></div>
    <div class="actions"><button id="add-expense">Add expense</button><button class="secondary" id="invite">Invite</button></div></div>
    <div class="grid"><section class="card"><h2>Balances</h2><div class="list">${group.balances.map(balance => `<div class="row"><span>${esc(member(balance.memberID))}</span><strong class="${balance.minorUnits<0?'negative':'positive'}">${esc(money(balance.minorUnits,group.currencyCode))}</strong></div>`).join('')}</div><p><button class="secondary" id="settle">Record settlement</button></p></section>
    <section class="card"><h2>Members</h2><div class="list">${group.members.map(person => `<div>${esc(person.name)} <span class="muted">· ${esc(person.email)}</span></div>`).join('')}</div></section></div>
    <section class="card"><h2>Expenses</h2><div class="list">${group.expenses.length ? group.expenses.map(expense => `<button data-expense="${esc(expense.id)}"><span>${esc(expense.merchant)} <small class="muted">· ${esc(member(expense.payerID))} paid</small></span><strong>${esc(money(expense.amountMinor,group.currencyCode))}</strong></button>`).join('') : '<p class="muted">No expenses yet.</p>'}</div></section>
    <section class="card"><h2>Settlements</h2><div class="list">${group.settlements.length ? group.settlements.map(item => `<div class="row"><span>${esc(member(item.fromID))} paid ${esc(member(item.toID))}</span><strong>${esc(money(item.amountMinor,group.currencyCode))}</strong></div>`).join('') : '<p class="muted">No settlements yet.</p>'}</div></section>`;
  document.querySelector('#add-expense').onclick=() => editExpense();
  document.querySelectorAll('[data-expense]').forEach(button => button.onclick=() => editExpense(group.expenses.find(item => item.id===button.dataset.expense)));
  document.querySelector('#invite').onclick=invite;
  document.querySelector('#settle').onclick=settle;
}
function invite() {
  const group=state.group;
  const modal=dialog(`<h2>Invite member</h2><form><label>Email<input name="email" type="email" required></label><div class="actions"><button type="submit">Create code</button><button type="button" class="secondary" data-close>Close</button></div></form><p id="invite-result"></p>`);
  bind(modal.querySelector('form'),async values => {
    const result=await api(`groups/${group.id}/invitations`,{method:'POST',body:values});
    const output=modal.querySelector('#invite-result'); output.textContent=`Send this private code to ${result.email}: ${result.inviteToken}`;
  });
}
function settle() {
  const group=state.group;
  const options=group.members.map(person => `<option value="${esc(person.id)}">${esc(person.name)}</option>`).join('');
  const modal=dialog(`<h2>Record settlement</h2><form><label>From<select name="fromID">${options}</select></label><label>To<select name="toID">${options}</select></label><label>Amount (${esc(group.currencyCode)})<input name="amount" type="number" step="any" min="0" required></label><div class="actions"><button type="submit">Save</button><button type="button" class="secondary" data-close>Cancel</button></div></form>`);
  bind(modal.querySelector('form'),async values => {
    await api(`groups/${group.id}/settlements`,{method:'POST',body:{id:crypto.randomUUID(),groupVersion:group.version,fromID:values.fromID,toID:values.toID,amountMinor:units(values.amount,group.currencyCode)}});
    modal.close(); await openGroup(group.id);
  });
}
function editExpense(existing) {
  const group=state.group;
  const option=group.members.map(person => `<option value="${esc(person.id)}" ${existing?.payerID===person.id?'selected':''}>${esc(person.name)}</option>`).join('');
  const memberInputs=group.members.map(person => {
    const selected=!existing || existing.allocations.some(share => share.memberID===person.id);
    const index=existing?.allocations.findIndex(share => share.memberID===person.id) ?? -1;
    return `<div class="split-person"><label><span>${esc(person.name)}</span><input type="checkbox" class="participant" value="${esc(person.id)}" ${selected?'checked':''}></label><label class="split-value" style="display:none"><span>Share</span><input type="number" step="any" min="0" data-value="${esc(person.id)}" value="${index>=0?esc(existing.values[index]):''}"></label></div>`;
  }).join('');
  const date=existing?.occurredAt.slice(0,10) || new Date().toISOString().slice(0,10);
  const amount=existing? (existing.amountMinor / 10 ** digitsFor(group.currencyCode)).toFixed(digitsFor(group.currencyCode)) : '';
  const modal=dialog(`<h2>${existing?'Edit':'Add'} expense</h2><form><label>Description<input name="merchant" value="${esc(existing?.merchant||'')}" required maxlength="120"></label><label>Amount (${esc(group.currencyCode)})<input name="amount" type="number" step="any" min="0" value="${esc(amount)}" required></label><label>Date<input name="date" type="date" value="${esc(date)}" required></label><label>Category<select name="category">${['groceries','dining','travel','shopping','household','health','other'].map(value => `<option value="${value}" ${existing?.category===value?'selected':''}>${value}</option>`).join('')}</select></label><label>Notes<textarea name="notes" maxlength="2000">${esc(existing?.notes||'')}</textarea></label><label>Paid by<select name="payerID">${option}</select></label><label>Split method<select name="method"><option value="equal">Equal</option><option value="exact">Exact minor units</option><option value="percentage">Percentage</option></select></label><div>${memberInputs}</div><label>Receipt image<input name="receipt" type="file" accept="image/jpeg,image/png"></label><div class="actions"><button type="submit">Save</button>${existing?'<button type="button" class="danger" id="delete">Delete</button>':''}<button type="button" class="secondary" data-close>Cancel</button></div></form>${existing?.hasReceipt?'<button class="secondary" id="view-receipt">View receipt</button>':''}`);
  const form=modal.querySelector('form'); form.elements.method.value=existing?.method||'equal';
  const updateValues=() => modal.querySelectorAll('.split-value').forEach(label => label.style.display=form.elements.method.value==='equal'?'none':'grid');
  form.elements.method.onchange=updateValues; updateValues();
  bind(form,async values => {
    const participants=[...modal.querySelectorAll('.participant:checked')].map(item => item.value);
    if (!participants.length) throw Error('Select at least one member.');
    const shares=values.method==='equal'?[]:participants.map(id => modal.querySelector(`[data-value="${id}"]`).value);
    const amountMinor=units(values.amount,group.currencyCode);
    if (values.method==='exact' && shares.some(value => !Number.isSafeInteger(Number(value)))) throw Error('Exact shares must be integer minor units.');
    const id=existing?.id||crypto.randomUUID();
    const body={id,merchant:values.merchant,occurredAt:new Date(`${values.date}T12:00:00Z`).toISOString(),category:values.category,notes:values.notes,amountMinor,payerID:values.payerID,method:values.method,participants,values:shares,version:existing?.version??null};
    const saved=await api(`groups/${group.id}/expenses/${id}`,{method:'PUT',body});
    const receipt=form.elements.receipt.files[0];
    if(receipt) await api(`groups/${group.id}/expenses/${id}/receipt`,{method:'PUT',headers:{'Content-Type':receipt.type},body:receipt});
    modal.close(); await openGroup(group.id);
  });
  if(existing) {
    modal.querySelector('#delete').onclick=async () => {
      if(!confirm('Delete this expense?')) return;
      try { await api(`groups/${group.id}/expenses/${existing.id}?version=${existing.version}`,{method:'DELETE'}); modal.close(); await openGroup(group.id); } catch(cause) { error(cause.message); }
    };
    if(existing.hasReceipt) modal.querySelector('#view-receipt').onclick=async () => {
      try { const blob=await api(`groups/${group.id}/expenses/${existing.id}/receipt`); const url=URL.createObjectURL(blob); window.open(url,'_blank','noopener'); setTimeout(()=>URL.revokeObjectURL(url),60000); } catch(cause) { error(cause.message); }
    };
  }
}
refresh();
