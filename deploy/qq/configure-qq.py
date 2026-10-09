"""Private local credential entry. Values travel only through SSH stdin."""
import base64,json,os,re,subprocess,threading,tkinter as tk
from pathlib import Path
from tkinter import messagebox,ttk
REMOTE=r'''
import json,os,re,sys,tempfile,subprocess,urllib.request
from pathlib import Path
env=Path('/etc/dnd-card-cloud-qq.env');old=None;changed=False
def health():
 with urllib.request.urlopen('http://127.0.0.1:5014/api/health',timeout=10) as r:return json.load(r)
def write(data):
 fd,name=tempfile.mkstemp(prefix='.dnd-card-cloud-qq-',dir='/etc')
 try:
  os.fchmod(fd,0o600)
  with os.fdopen(fd,'wb') as stream:stream.write(data);stream.flush();os.fsync(stream.fileno())
  os.replace(name,env)
 finally:
  if os.path.exists(name):os.unlink(name)
def restart():subprocess.run(['systemctl','restart','dnd-card-cloud'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 assert os.geteuid()==0 and health().get('qqOAuthSupported') is True
 data=json.load(sys.stdin);app=data['appId'];key=data['appKey']
 assert re.fullmatch(r'[0-9]{3,20}',app) and re.fullmatch(r'[A-Za-z0-9]{8,128}',key)
 assert not env.is_symlink()
 old=env.read_bytes() if env.exists() else None
 if old is not None:
  fd,backup=tempfile.mkstemp(prefix='dnd-card-cloud-qq-env-backup-',dir='/root')
  os.fchmod(fd,0o600)
  with os.fdopen(fd,'wb') as stream:stream.write(old)
 write(('QQ_APPID='+app+'\nQQ_APPKEY='+key+'\nQQ_CALLBACK=https://dnd.center/api/auth/qq/callback\n').encode());changed=True;restart()
 import time
 for attempt in range(12):
  try:
   if health().get('qqLogin')=='ready':break
  except Exception:pass
  time.sleep(1)
 else:raise RuntimeError()
 print(json.dumps({'configured':True,'qqLogin':'ready'}))
except Exception:
 if changed:
  try:
   if old is None:env.unlink(missing_ok=True)
   else:write(old)
   restart()
  except Exception:pass
 print(json.dumps({'configured':False}));sys.exit(1)
'''
def main():
 root=tk.Tk();root.title('配置网站 QQ 登录');root.resizable(False,False)
 frame=ttk.Frame(root,padding=22);frame.grid()
 ttk.Label(frame,text='从 QQ 互联复制 AppID 和 AppKey。\n密钥只发送到你的网站服务器，不保存到本机。',justify='left').grid(column=0,row=0,columnspan=2,pady=(0,18),sticky='w')
 app=tk.StringVar();key=tk.StringVar();status=tk.StringVar()
 ttk.Label(frame,text='AppID').grid(column=0,row=1,sticky='w');ttk.Entry(frame,textvariable=app,width=42).grid(column=1,row=1,pady=6)
 ttk.Label(frame,text='AppKey').grid(column=0,row=2,sticky='w');ttk.Entry(frame,textvariable=key,show='●',width=42).grid(column=1,row=2,pady=6)
 ttk.Label(frame,textvariable=status,wraplength=380).grid(column=0,row=4,columnspan=2,pady=12)
 def done(ok):
  button.configure(state='normal')
  if ok:
   app.set('');key.set('');status.set('已配置。现在可以用调试 QQ 号测试网站登录。');messagebox.showinfo('配置完成','服务器已启用 QQ 登录。请回到聊天，告知“配置成功”。')
  else:status.set('配置未完成。请确认网站更新已部署、网络可连接，再重试。密钥内容不会写入错误记录。')
 def submit():
  app_id=app.get().strip();app_key=key.get().strip()
  if not re.fullmatch(r'[0-9]{3,20}',app_id) or not re.fullmatch(r'[A-Za-z0-9]{8,128}',app_key):messagebox.showerror('请检查输入','请填写 QQ 互联提供的 AppID 和 AppKey。');return
  sshkey=Path(os.environ['USERPROFILE'])/'.ssh/dnd-center-deploy_ed25519'
  if not sshkey.is_file():messagebox.showerror('无法连接','未找到这台电脑原有的网站部署密钥。请回到聊天说明这个提示。');return
  button.configure(state='disabled');status.set('正在配置服务器，请稍候……')
  def run():
   ok=False
   try:
    code=base64.b64encode(REMOTE.encode()).decode();command="python3 -c 'import base64;exec(base64.b64decode(\""+code+"\"))'"
    result=subprocess.run(['ssh','-i',str(sshkey),'-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=12','root@obr.dnd.center',command],input=json.dumps({'appId':app_id,'appKey':app_key}),text=True,encoding='utf-8',capture_output=True,timeout=60,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    ok=result.returncode==0 and json.loads(result.stdout).get('configured') is True
   except Exception:pass
   root.after(0,lambda:done(ok))
  threading.Thread(target=run,daemon=True).start()
 button=ttk.Button(frame,text='配置服务器',command=submit);button.grid(column=0,row=3,columnspan=2,pady=(16,0))
 root.mainloop()
if __name__=='__main__':main()
