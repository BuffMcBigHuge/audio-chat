{ pkgs }: {
  deps = [
    pkgs.nodejs_22
    pkgs.npm
    pkgs.nodePackages.typescript
    pkgs.nodePackages.typescript-language-server
    pkgs.nodePackages.vscode-langservers-extracted
    pkgs.nodePackages.eslint
  ];
} 