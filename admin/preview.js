if (window.CMS) {
  CMS.registerPreviewStyle('../assets/styles/normalize.css');
  CMS.registerPreviewStyle('../assets/styles/styles.css');
  CMS.registerPreviewStyle('./preview.css');

  var h = window.h;

  function get(entry, path, fallback) {
    var value = entry.getIn(['data'].concat(path));
    if (value === undefined || value === null) return fallback || '';
    if (value && typeof value.toJS === 'function') return value.toJS();
    return value;
  }

  function assetUrl(getAsset, value) {
    if (!value) return '';
    var asset = getAsset ? getAsset(value) : value;
    return asset && asset.toString ? asset.toString() : String(asset || value);
  }

  function textBlock(value) {
    if (!value) return null;
    return h('p', {}, value);
  }

  function previewShell(children) {
    return h('main', { className: 'cms-preview-page' }, children);
  }

  function backgroundImage(getAsset, image, alt, tight) {
    if (!image) return null;
    return h('div', { className: tight ? 'background-image tight-fade' : 'background-image' },
      h('img', { src: assetUrl(getAsset, image), alt: alt || '' })
    );
  }

  function hero(entry, getAsset) {
    var title = get(entry, ['hero_title']) || get(entry, ['title']);
    var text = get(entry, ['hero_text']) || get(entry, ['excerpt']) || get(entry, ['description']);
    var image = get(entry, ['hero_image']);
    var alt = get(entry, ['hero_image_alt']) || title;
    return [
      backgroundImage(getAsset, image, alt, true),
      h('header', {},
        h('h1', {}, title),
        text ? h('p', {}, text) : null
      )
    ];
  }

  function renderMarkdown(widgetFor, fieldName) {
    try {
      return widgetFor(fieldName || 'body');
    } catch (error) {
      return null;
    }
  }

  function renderSection(section, getAsset) {
    var type = section.type || section.name;
    if (type === 'text') {
      return h('section', {},
        h('div', { className: 'section-content' },
          section.label ? h('pre', {}, section.label) : null,
          section.heading ? h('h2', {}, section.heading) : null,
          textBlock(section.text)
        )
      );
    }

    if (type === 'text_image') {
      var image = section.image ? h('div', { className: 'grid-cell' },
        h('img', { className: 'section-image', src: assetUrl(getAsset, section.image), alt: section.image_alt || section.heading || '' })
      ) : null;
      var copy = h('div', { className: 'grid-cell' },
        section.label ? h('pre', {}, section.label) : null,
        section.heading ? h('h2', {}, section.heading) : null,
        textBlock(section.text)
      );
      var children = section.image_position === 'left' ? [image, copy] : [copy, image];
      return h('section', {},
        h('div', { className: 'grid-row align-center section-content' }, children)
      );
    }

    if (type === 'cards') {
      var cards = (section.cards || []).map(function (card) {
        return h('div', { className: 'grid-cell blur-box' },
          h('div', {},
            card.image ? h('img', { src: assetUrl(getAsset, card.image), alt: card.title || '' }) : null,
            card.title ? h('h3', {}, card.title) : null,
            card.text ? h('p', {}, card.text) : null
          )
        );
      });
      return h('section', {},
        h('div', { className: 'section-content' },
          section.heading ? h('h2', { className: 'text-center' }, section.heading) : null,
          h('div', { className: 'grid-row gap-small grid-3-columns' }, cards)
        )
      );
    }

    if (type === 'feature_list') {
      return h('section', {},
        h('div', { className: 'section-content' },
          section.heading ? h('h2', {}, section.heading) : null,
          h('ul', { className: 'prominent' }, (section.features || []).map(function (feature) {
            return h('li', {},
              h('span', { className: 'material-symbols-outlined' }, 'check_small'),
              h('span', {}, feature)
            );
          }))
        )
      );
    }

    if (type === 'process_steps') {
      return h('section', {},
        h('div', { className: 'section-content blur-box' },
          section.heading ? h('h2', {}, section.heading) : null,
          h('div', { className: 'custom-list' }, (section.steps || []).map(function (step, index) {
            return h('div', {},
              h('div', { className: 'number' }, String(index + 1)),
              step.title ? h('h3', {}, step.title) : null,
              h('p', {}, step.text || '')
            );
          }))
        )
      );
    }

    if (type === 'gallery') {
      return h('section', {},
        h('div', { className: 'section-content grid-row gap-small grid-3-columns' }, (section.images || []).map(function (item) {
          return h('div', { className: 'grid-cell' },
            h('img', { src: assetUrl(getAsset, item.image), alt: item.alt || '' })
          );
        }))
      );
    }

    if (type === 'cta') {
      return h('section', { className: 'cta' },
        h('div', { className: 'section-content' },
          section.heading ? h('h2', {}, section.heading) : null,
          section.text ? h('p', { className: 'text-large' }, section.text) : null,
          section.button_label ? h('div', { className: 'mt-2 mb-2 text-center' },
            h('span', { className: 'button button-large' }, section.button_label)
          ) : null
        )
      );
    }

    if (type === 'markdown') {
      return h('section', {},
        h('div', { className: 'section-content' }, textBlock(section.content))
      );
    }

    return null;
  }

  function renderSections(entry, getAsset) {
    var sections = get(entry, ['sections'], []);
    if (!sections || !sections.length) return null;
    return sections.map(function (section) {
      return renderSection(section, getAsset);
    });
  }

  function ArticlePreview(props) {
    var entry = props.entry;
    var getAsset = props.getAsset;
    var title = get(entry, ['title']);
    var excerpt = get(entry, ['excerpt']);
    var heroImage = get(entry, ['hero_image']) || get(entry, ['og_image']);
    return previewShell([
      backgroundImage(getAsset, heroImage, get(entry, ['hero_image_alt']) || title, false),
      h('header', {},
        h('span', { className: 'cms-preview-back' }, 'Back'),
        h('h1', {}, title),
        excerpt ? h('p', {}, excerpt) : null
      ),
      h('section', { className: 'blog-post' },
        h('div', { className: 'section-content' }, renderMarkdown(props.widgetFor, 'body'))
      )
    ]);
  }

  function PagePreview(props) {
    var entry = props.entry;
    return previewShell([].concat(
      hero(entry, props.getAsset),
      h('div', { className: 'cms-preview-body' }, renderMarkdown(props.widgetFor, 'body')),
      renderSections(entry, props.getAsset) || []
    ));
  }

  function ServicePreview(props) {
    var entry = props.entry;
    var getAsset = props.getAsset;
    return previewShell([
      h('section', {},
        h('div', { className: 'section-content' },
          h('div', { className: 'grid-row gap-small grid-3-columns' },
            h('div', { className: 'grid-cell blur-box' },
              h('div', {},
                get(entry, ['image']) ? h('img', { src: assetUrl(getAsset, get(entry, ['image'])), alt: get(entry, ['image_alt']) || get(entry, ['title']) }) : null,
                h('h3', {}, get(entry, ['title'])),
                get(entry, ['summary']) ? h('p', {}, get(entry, ['summary'])) : null
              )
            )
          )
        )
      )
    ]);
  }

  function PricingPreview(props) {
    var entry = props.entry;
    var getAsset = props.getAsset;
    var features = get(entry, ['features'], []);
    return previewShell([
      h('section', {},
        h('div', { className: 'grid-row align-center section-content' },
          h('div', { className: 'grid-cell' },
            h('h2', {}, get(entry, ['title'])),
            get(entry, ['summary']) ? h('p', { className: 'text-large' }, get(entry, ['summary'])) : null,
            features.length ? h('ul', { className: 'prominent' }, features.map(function (feature) {
              return h('li', {},
                h('span', { className: 'material-symbols-outlined' }, 'check_small'),
                h('span', {}, feature)
              );
            })) : null,
            get(entry, ['price_text']) ? h('p', {}, get(entry, ['price_text'])) : null
          ),
          get(entry, ['image']) ? h('div', { className: 'grid-cell' },
            h('img', { className: 'section-image', src: assetUrl(getAsset, get(entry, ['image'])), alt: get(entry, ['image_alt']) || get(entry, ['title']) })
          ) : null
        )
      )
    ]);
  }

  function SupplierPreview(props) {
    var entry = props.entry;
    var getAsset = props.getAsset;
    return previewShell([
      h('section', {},
        h('div', { className: 'section-content blur-box' },
          get(entry, ['logo']) ? h('img', { className: 'cms-preview-logo', src: assetUrl(getAsset, get(entry, ['logo'])), alt: get(entry, ['name']) }) : null,
          h('h2', {}, get(entry, ['name'])),
          get(entry, ['description']) ? h('p', {}, get(entry, ['description'])) : null
        )
      )
    ]);
  }

  CMS.registerPreviewTemplate('articles', ArticlePreview);
  CMS.registerPreviewTemplate('site_pages', PagePreview);
  CMS.registerPreviewTemplate('product_series', PagePreview);
  CMS.registerPreviewTemplate('services', ServicePreview);
  CMS.registerPreviewTemplate('pricing_items', PricingPreview);
  CMS.registerPreviewTemplate('suppliers', SupplierPreview);
}
