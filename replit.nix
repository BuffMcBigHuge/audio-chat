{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.npm
    pkgs.nodePackages.typescript
    pkgs.nodePackages.typescript-language-server
    pkgs.nodePackages.vscode-langservers-extracted
    pkgs.nodePackages.eslint
  ];
} 