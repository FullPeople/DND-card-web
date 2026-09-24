param([Parameter(Mandatory=$true)][int]$BrowserProcessId)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::RootElement
Add-Type @'
using System; using System.Runtime.InteropServices; using System.Text; using System.Collections.Generic;
public class TestWindows {
 public delegate bool Callback(IntPtr hwnd, IntPtr state);
 [DllImport("user32.dll")] static extern bool EnumWindows(Callback callback,IntPtr state);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd,StringBuilder text,int size);
 public static List<IntPtr> Find(uint pid) {var rows=new List<IntPtr>();EnumWindows((hwnd,state)=>{uint found;GetWindowThreadProcessId(hwnd,out found);if(found==pid)rows.Add(hwnd);return true;},IntPtr.Zero);return rows;}
 public static string Class(IntPtr hwnd) {var text=new StringBuilder(128);GetClassName(hwnd,text,128);return text.ToString();}
}
'@
$process = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$BrowserProcessId)
$class = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty,'#32770')
$condition = New-Object System.Windows.Automation.AndCondition($process,$class)
$deadline = [DateTime]::UtcNow.AddSeconds(20)
do {
  $dialog = $null
  foreach ($handle in [TestWindows]::Find($BrowserProcessId)) {
    if ([TestWindows]::Class($handle) -eq '#32770') { $dialog = [System.Windows.Automation.AutomationElement]::FromHandle($handle); break }
  }
  if ($null -ne $dialog) { break }
  Start-Sleep -Milliseconds 100
} while ([DateTime]::UtcNow -lt $deadline)
if ($null -eq $dialog) {
  Write-Output "Isolated browser PID: $BrowserProcessId"
  Get-Process -Id $BrowserProcessId | Select-Object ProcessName,MainWindowHandle
  foreach ($handle in [TestWindows]::Find($BrowserProcessId)) {Write-Output ([TestWindows]::Class($handle)); $window=[System.Windows.Automation.AutomationElement]::FromHandle($handle); Write-Output $window.Current.Name}
  throw 'Native dialog for the isolated test browser was not found'
}
$cancelId = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'2')
$cancel = $dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$cancelId)
if ($null -eq $cancel) { throw 'Native cancel button was not found' }
$pattern = $cancel.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
$pattern.Invoke()
Write-Output 'CANCELLED_NATIVE_DIALOG'
