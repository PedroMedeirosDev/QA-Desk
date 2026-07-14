// Exporta correções Sentry para CSV (Google Sheets / Copilot).
//
// Uso (na pasta polygonus-sentry-suporte):
//   dart run tool/export_suporte_por_versao.dart
//   dart run tool/export_suporte_por_versao.dart --versao=6.05.16
//   dart run tool/export_suporte_por_versao.dart --versao=6.05.16 --saida=relatorio.csv
//
// Colunas: ver cabeçalhos em português na primeira linha do CSV gerado.

import 'dart:convert';
import 'dart:io';

void main(List<String> args) {
  final versaoFiltro = _argValor(args, '--versao');
  final saidaPath =
      _argValor(args, '--saida') ?? 'data/sentry_correcoes_suporte_copilot.csv';

  final root = Directory.current;
  final jsonFile = File.fromUri(root.uri.resolve('data/sentry_correcoes_suporte.json'));

  if (!jsonFile.existsSync()) {
    stderr.writeln('Arquivo não encontrado: ${jsonFile.path}');
    stderr.writeln('Execute a partir da raiz da pasta polygonus-sentry-suporte.');
    exit(1);
  }

  final map = jsonDecode(jsonFile.readAsStringSync()) as Map<String, dynamic>;
  final meta = (map['meta'] as Map<String, dynamic>?) ?? {};
  final list = (map['correcoes'] as List<dynamic>).cast<Map<String, dynamic>>();

  final List<Map<String, dynamic>> filtradas;
  if (versaoFiltro != null && versaoFiltro.isNotEmpty) {
    filtradas = list
        .where((e) {
          final v = (e['versao_correcao'] as String?) ?? '';
          return v == versaoFiltro;
        })
        .toList();
  } else {
    filtradas = List<Map<String, dynamic>>.from(list);
  }

  const headerPt = [
    'Versão (correção)',
    'ID triagem',
    'Data registro',
    'Título do erro',
    'Descrição para suporte (linguagem simples)',
    'Detalhes técnicos (código, arquivos, causa)',
    'Query Sentry (busca em issues)',
    'Event IDs Sentry (exemplos)',
    'Link Sentry (abrir busca)',
  ];

  final buffer = StringBuffer();
  buffer.writeln(headerPt.map(_csvCampo).join(','));
  for (final e in filtradas) {
    buffer.writeln(_linhaCsv(e, meta).map(_csvCampo).join(','));
  }

  final out = File.fromUri(root.uri.resolve(saidaPath));
  out.parent.createSync(recursive: true);
  // BOM UTF-8 para Excel no Windows.
  out.writeAsStringSync('\uFEFF${buffer.toString()}', encoding: utf8);

  stdout.writeln(
    'Escrito: ${out.path} (${filtradas.length} linha(s)${versaoFiltro != null ? ", versao=$versaoFiltro" : ""}).',
  );
}

String? _argValor(List<String> args, String nome) {
  for (final a in args) {
    if (a.startsWith('$nome=')) {
      return a.substring(nome.length + 1);
    }
  }
  return null;
}

String _linkSentryIssue(Map<String, dynamic> meta, String query) {
  final q = query.trim();
  if (q.isEmpty) return '';
  final enc = Uri.encodeQueryComponent(q);
  final tpl = meta['sentry_issues_url_template'] as String?;
  if (tpl != null && tpl.contains('{query}')) {
    return tpl.replaceAll('{query}', enc);
  }
  return 'https://sentry.io/organizations/polygonus/issues/?project=4511175512883200&query=$enc';
}

List<String> _linhaCsv(Map<String, dynamic> e, Map<String, dynamic> meta) {
  final events = e['sentry_event_ids'];
  String eventsStr = '';
  if (events is List) {
    eventsStr = events.join('; ');
  }
  final q = e['sentry_issue_query']?.toString() ?? '';
  return [
    e['versao_correcao']?.toString() ?? '',
    e['id']?.toString() ?? '',
    e['data']?.toString() ?? '',
    e['titulo']?.toString() ?? '',
    e['texto_suporte']?.toString() ?? '',
    e['fix_tecnico']?.toString() ?? '',
    q,
    eventsStr,
    _linkSentryIssue(meta, q),
  ];
}

String _csvCampo(String raw) {
  final s = raw.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  if (s.contains('"') || s.contains(',') || s.contains('\n')) {
    return '"${s.replaceAll('"', '""')}"';
  }
  return s;
}
