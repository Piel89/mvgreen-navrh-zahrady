/*
 * MVGreen AI architekt v2 – ověřený výběr rostlin (2026-11-08).
 * Po 1. testu (Martin): náhodný výběr z katalogu 805 dával nejasné „(okrasný druh)“ a nevhodné
 * rostliny (rododendron bez kyselé půdy, Rubus, zimostráz s housenkou). Tady je 33 běžně
 * dostupných, spolehlivých druhů do českých zahrad s údaji pro rozmístění a výkres.
 * role: back = dozadu k plotu/zdi, mid = střed, front = lem; sun: Slunce/Polostín/Stín;
 * water: dry/normal/wet; h = výška v dospělosti (m), s = spon (m), b = měsíce kvetení/ozdoby.
 * thorny = trny (nevhodné k dětem). Údaje jsou orientační – v PDF se doplňují a ověřují.
 */
(function () {
  'use strict';
  var P = function (name, latin, kind, role, h, s, sun, water, flower, leaf, b, extra) {
    return Object.assign({ key: latin.toLowerCase().replace(/[^a-z]+/g, '-'), name: name, latin: latin, kind: kind, role: role, height: h, spon: s, sun: sun, water: water, flower: flower || '', leaf: leaf, bloom: b, color: flower || leaf }, extra || {});
  };
  var S = ['Slunce'], SP = ['Slunce', 'Polostín'], PS = ['Polostín', 'Stín'], ALL = ['Slunce', 'Polostín', 'Stín'];
  window.MVGreenPlantsV2 = [
    // trvalky
    P('Šalvěj hajní ‘Caradonna’', 'Salvia nemorosa ‘Caradonna’', 'perennial', 'mid', 0.5, 0.4, S, ['dry', 'normal'], '#6B5BB5', '#7E9A6E', [6, 9]),
    P('Šanta Faassenova ‘Walker’s Low’', 'Nepeta × faassenii ‘Walker’s Low’', 'perennial', 'front', 0.5, 0.45, SP, ['dry', 'normal'], '#8E86C9', '#9AAA8C', [5, 9]),
    P('Levandule úzkolistá ‘Hidcote’', 'Lavandula angustifolia ‘Hidcote’', 'perennial', 'front', 0.4, 0.4, S, ['dry'], '#6E5FB3', '#8A9A82', [6, 8]),
    P('Třapatkovka nachová', 'Echinacea purpurea', 'perennial', 'mid', 0.8, 0.45, S, ['dry', 'normal'], '#C9548F', '#6E8F5A', [7, 9]),
    P('Třapatka zářivá ‘Goldsturm’', 'Rudbeckia fulgida ‘Goldsturm’', 'perennial', 'mid', 0.6, 0.45, SP, ['normal'], '#E6B931', '#5E7F4B', [7, 10]),
    P('Kakost ‘Rozanne’', 'Geranium ‘Rozanne’', 'perennial', 'front', 0.4, 0.5, SP, ['normal'], '#7E8FC9', '#6E8F5A', [6, 10]),
    P('Rozchodník ‘Herbstfreude’', 'Hylotelephium ‘Herbstfreude’', 'perennial', 'mid', 0.5, 0.4, S, ['dry'], '#C25B6E', '#8FA77E', [8, 10]),
    P('Řebříček ‘Terracotta’', 'Achillea millefolium ‘Terracotta’', 'perennial', 'mid', 0.6, 0.4, S, ['dry'], '#D9875A', '#8FA77E', [6, 9]),
    P('Kopretina ‘Becky’', 'Leucanthemum × superbum ‘Becky’', 'perennial', 'mid', 0.9, 0.45, S, ['normal'], '#FBFAF2', '#5E7F4B', [7, 9]),
    P('Denivka ‘Stella de Oro’', 'Hemerocallis ‘Stella de Oro’', 'perennial', 'front', 0.4, 0.45, SP, ['normal'], '#E9B52E', '#6E8F5A', [6, 9]),
    P('Kontryhel měkký', 'Alchemilla mollis', 'perennial', 'front', 0.4, 0.4, SP, ['normal'], '#CFD36A', '#9AB07A', [6, 7]),
    P('Hvězdnice ‘Lady in Blue’', 'Aster dumosus ‘Lady in Blue’', 'perennial', 'front', 0.35, 0.4, SP, ['normal'], '#6F7FD0', '#6E8F5A', [9, 10]),
    P('Mateřídouška ‘Coccineus’', 'Thymus serpyllum ‘Coccineus’', 'perennial', 'front', 0.1, 0.3, S, ['dry'], '#C25B9E', '#7E9A6E', [6, 7]),
    P('Bohyška ‘Francee’', 'Hosta ‘Francee’', 'perennial', 'front', 0.5, 0.6, PS, ['normal', 'wet'], '#E0DDF5', '#4E7A40', [7, 8]),
    P('Bergénie srdčitá', 'Bergenia cordifolia', 'perennial', 'front', 0.4, 0.45, PS, ['normal'], '#D86A9A', '#4E7A40', [4, 5]),
    P('Čechrava ‘Fanal’', 'Astilbe × arendsii ‘Fanal’', 'perennial', 'mid', 0.6, 0.4, PS, ['normal', 'wet'], '#B8303E', '#4E6A3F', [6, 8]),
    P('Brčál menší', 'Vinca minor', 'perennial', 'front', 0.15, 0.3, PS, ['normal'], '#6F7FD0', '#3F6E45', [4, 5]),
    // trávy
    P('Třtina ostrokvětá ‘Karl Foerster’', 'Calamagrostis × acutiflora ‘Karl Foerster’', 'grass', 'back', 1.5, 0.6, SP, ['normal'], '', '#BDB46A', [6, 9]),
    P('Dochan ‘Hameln’', 'Pennisetum alopecuroides ‘Hameln’', 'grass', 'mid', 0.6, 0.6, S, ['normal'], '', '#C9BE8A', [8, 10]),
    P('Ozdobnice čínská ‘Gracillimus’', 'Miscanthus sinensis ‘Gracillimus’', 'grass', 'back', 1.6, 1.0, S, ['normal'], '', '#B5AE68', [9, 10]),
    P('Kostřava sivá', 'Festuca glauca', 'lowgrass', 'front', 0.25, 0.3, S, ['dry'], '', '#9AB3BB', [6, 6]),
    P('Ostřice ‘Evergold’', 'Carex oshimensis ‘Evergold’', 'lowgrass', 'front', 0.3, 0.4, PS, ['normal'], '', '#C8C46A', [4, 10]),
    P('Hakonechloa ‘Aureola’', 'Hakonechloa macra ‘Aureola’', 'lowgrass', 'front', 0.35, 0.4, PS, ['normal'], '', '#D3C35A', [5, 10]),
    // keře
    P('Hortenzie latnatá ‘Limelight’', 'Hydrangea paniculata ‘Limelight’', 'shrub', 'back', 1.8, 1.5, SP, ['normal'], '#FBFAF2', '#4B7A40', [7, 10]),
    P('Hortenzie stromkovitá ‘Annabelle’', 'Hydrangea arborescens ‘Annabelle’', 'shrub', 'back', 1.2, 1.2, PS, ['normal'], '#FBFAF2', '#4B7A40', [6, 9]),
    P('Tavolník japonský ‘Goldflame’', 'Spiraea japonica ‘Goldflame’', 'shrub', 'mid', 0.6, 0.6, SP, ['normal'], '#E0708A', '#CDB13C', [6, 7]),
    P('Tavolník ‘Little Princess’', 'Spiraea japonica ‘Little Princess’', 'shrub', 'mid', 0.5, 0.6, SP, ['normal'], '#E58AA8', '#5E8E46', [6, 7]),
    P('Mochna křovitá ‘Goldfinger’', 'Potentilla fruticosa ‘Goldfinger’', 'shrub', 'mid', 0.8, 0.8, S, ['dry', 'normal'], '#E6B931', '#6E8F5A', [6, 10]),
    P('Vajgélie ‘Nana Purpurea’', 'Weigela florida ‘Nana Purpurea’', 'shrub', 'mid', 0.9, 0.9, SP, ['normal'], '#E58AA8', '#7E3C47', [5, 6]),
    P('Dřišťál ‘Atropurpurea Nana’', 'Berberis thunbergii ‘Atropurpurea Nana’', 'shrub', 'mid', 0.5, 0.6, SP, ['dry', 'normal'], '', '#8E3440', [4, 11], { thorny: true }),
    P('Pustoryl ‘Manteau d’Hermine’', 'Philadelphus ‘Manteau d’Hermine’', 'shrub', 'back', 0.8, 0.9, SP, ['normal'], '#FBFAF2', '#5E8E46', [6, 6]),
    P('Komule Davidova ‘Nanho Blue’', 'Buddleja davidii ‘Nanho Blue’', 'shrub', 'back', 1.5, 1.2, S, ['normal'], '#6F5FB5', '#7E9A6E', [7, 9]),
    P('Kalina ‘Eskimo’', 'Viburnum ‘Eskimo’', 'shrub', 'back', 1.2, 1.2, ALL, ['normal'], '#FBFAF2', '#3F6E45', [5, 5])
  ];
})();
