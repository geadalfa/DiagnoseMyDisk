; Inno Setup Script untuk DiagnoseMyDisk
; Menghasilkan installer mandiri profesional: DiagnoseMyDisk_Setup.exe

#define MyAppName "DiagnoseMyDisk"
#define MyAppVersion "1.4.1"
#define MyAppPublisher "Alfa & Gemi"
#define MyAppExeName "DiagnoseMyDisk.exe"

[Setup]
AppId={{9D23B654-7128-4FA1-9C80-141974751A22}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=C:\Users\Alfa\.gemini\antigravity\scratch\diskpulse-health\installer_output
OutputBaseFilename=DiagnoseMyDisk_Setup
SetupIconFile=C:\Users\Alfa\.gemini\antigravity\scratch\diskpulse-health\app_icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "C:\Users\Alfa\.gemini\antigravity\scratch\diskpulse-health\dist\DiagnoseMyDisk\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Jalankan {#MyAppName} sekarang"; Flags: nowait postinstall skipifsilent
