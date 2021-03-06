/**
 * DropKick
 *
 * Highly customizable <select> lists
 * https://github.com/robdel12/DropKick
 *
 * &copy; 2011 Jamie Lottering <http://github.com/JamieLottering>
 *                        <http://twitter.com/JamieLottering>
 *
 */
(function ($, window, document) {

  var msVersion = navigator.userAgent.match(/MSIE ([0-9]{1,}[\.0-9]{0,})/),
      msie = !!msVersion,
      ie6 = msie && parseFloat(msVersion[1]) < 7;

  // Help prevent flashes of unstyled content
  if (!ie6) {
    document.documentElement.className = document.documentElement.className + ' dk_fouc';
  }

  var
    // Public methods exposed to $.fn.dropkick()
    methods = {},

    // Cache every <select> element that gets dropkicked
    lists   = [],

    // Convenience keys for keyboard navigation
    keyMap = {
      'left'  : 37,
       'up'    : 38,
       'right' : 39,
       'down'  : 40,
       'enter' : 13,
       'tab'   : 9,
       'zero'  : 48,
       'z'     : 90,
       'last': 221  //support extend charsets such as Danish, Ukrainian etc.
    },

    // HTML template for the dropdowns
    dropdownTemplate = [
      '<div class="dk_container" id="dk_container_{{ id }}" tabindex="{{ tabindex }}">',
        '<a class="dk_toggle">',
          '<span class="dk_label">{{ label }}</span>',
        '</a>',
        '<div class="dk_options">',
          '<ul class="dk_options_inner">',
          '</ul>',
        '</div>',
      '</div>'
    ].join(''),

    // HTML template for dropdown options
    optionTemplate = '<li class="{{ current }} {{ disabled }}"><a data-dk-dropdown-value="{{ value }}">{{ text }}</a></li>',

    // Some nice default values
    defaults = {
      startSpeed : 1000,  // I recommend a high value here, I feel it makes the changes less noticeable to the user
      theme  : false,
      change : false,
      reverseSync: false
    },

    // Make sure we only bind keydown on the document once
    keysBound = false
  ;

  // Called by using $('foo').dropkick();
  methods.init = function (settings) {
    settings = $.extend({}, defaults, settings);

    return this.each(function () {
      var
        // The current <select> element
        $select = $(this),

        // Store a reference to the originally selected <option> element
        $original = $select.find(':selected').first(),

        // Save all of the <option> elements
        $options = $select.find('option'),

        // We store lots of great stuff using jQuery data
        data = $select.data('dropkick') || {},

        // This gets applied to the 'dk_container' element
        id = $select.attr('id') || $select.attr('name'),

        // This gets updated to be equal to the longest <option> element
        width  = settings.width || $select.outerWidth(),

        // Check if we have a tabindex set or not
        tabindex  = $select.attr('tabindex') ? $select.attr('tabindex') : '',

        // The completed dk_container element
        $dk = false,

        theme
      ;

      // Dont do anything if we've already setup dropkick on this element
      if (data.id) {
        return $select;
      } else {
        data.settings  = settings;
        data.tabindex  = tabindex;
        data.id        = id;
        data.$original = $original;
        data.$select   = $select;
        data.value     = _notBlank($select.val()) || _notBlank($original.attr('value'));
        data.label     = $original.text();
        data.options   = $options;
      }

      // Build the dropdown HTML
      $dk = _build(dropdownTemplate, data);

      // Make the dropdown fixed width if desired
      $dk.find('.dk_toggle').css({
        'width' : width + 'px'
      });

      // Hide the <select> list and place our new one in front of it
      $select.before($dk);

      // Update the reference to $dk
      $dk = $('div[id="dk_container_' + id + '"]').fadeIn(settings.startSpeed);

      // Save the current theme
      theme = settings.theme ? settings.theme : 'default';
      $dk.addClass('dk_theme_' + theme);
      data.theme = theme;

      // Save the updated $dk reference into our data object
      data.$dk = $dk;

      // Save the dropkick data onto the <select> element
      $select.data('dropkick', data);

      // Do the same for the dropdown, but add a few helpers
      $dk.data('dropkick', data);

      lists[lists.length] = $select;

      // Focus events
      $dk.bind('focus.dropkick', function (e) {
        $dk.addClass('dk_focus');
      }).bind('blur.dropkick', function (e) {
        $dk.removeClass('dk_open dk_focus');
      });

      // Sync to change events on the original <select> if requested
      if (data.settings.reverseSync) {
        $select.bind('change', function(e){
          var $dkopt = $(':[data-dk-dropdown-value="'+$select.val()+'"]', $dk);
          _updateFields($dkopt, $dk, true);
        });
      }

      setTimeout(function () {
        $select.hide();
      }, 0);
    });
  };

  // Allows dynamic theme changes
  methods.theme = function (newTheme) {
    var
      $select   = $(this),
      list      = $select.data('dropkick'),
      $dk       = list.$dk,
      oldtheme  = 'dk_theme_' + list.theme
    ;

    $dk.removeClass(oldtheme).addClass('dk_theme_' + newTheme);

    list.theme = newTheme;
  };

  // Public method for opening the component.
  //    Useful if needing to open the component via another behavior path other than component related UI.
  // @example   $(".dropkick_target").dropkick("open"); // Open many at once matching the selector
  // @example   $("#top_selector").dropkick("open");    // Open a single one; useful in validation situations
  methods.open = function () {
    var $dk = _getDKElement(this);
    _openDropdown($dk);
  };

  // Public method for closing the component.
  //    Useful if needing to close the component via another behavior path other than component related UI.
  // @example   $(".dropkick_target").dropkick("close"); // Close all matching the selector
  methods.close = function () {
    var $dk = _getDKElement(this);
    _closeDropdown($dk);
  };

  // Reset all <selects and dropdowns in our lists array
  methods.reset = function () {
    for (var i = 0, l = lists.length; i < l; i++) {
      var
        listData  = lists[i].data('dropkick'),
        $dk       = listData.$dk,
        $current  = $dk.find('li').first()
      ;

      $dk.find('.dk_label').text(listData.label);
      $dk.find('.dk_options_inner').animate({ scrollTop: 0 }, 0);

      _setCurrent($current, $dk);
      _updateFields($current, $dk, true);
    }
  };

  // Reload / rebuild, in case of dynamic updates etc.
  // Credits to Jeremy (http://stackoverflow.com/users/1380047/jeremy-p)
  methods.reload = function () {
    var $select = $(this);
    var data = $select.data('dropkick');
    $select.removeData("dropkick");
    $("#dk_container_"+ data.id).remove();
    $select.dropkick(data.settings);
  };

  methods.setValue = function (value) {
    var $dk = $(this).data('dropkick').$dk;
    var $option = $dk.find('.dk_options a[data-dk-dropdown-value="' + value + '"]');
    _updateFields($option, $dk);
  };

  // Expose the plugin
  $.fn.dropkick = function (method) {
    if (!ie6) {
      if (methods[method]) {
        return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
      } else if (typeof method === 'object' || ! method) {
        return methods.init.apply(this, arguments);
      }
    }
  };

  // private
  function _handleKeyBoardNav(e, $dk) {
    var
      code     = e.keyCode,
      data     = $dk.data('dropkick'),
      letter   = String.fromCharCode(code),
      options  = $dk.find('.dk_options'),
      open     = $dk.hasClass('dk_open'),
      lis      = options.find('li'),
      current  = $dk.find('.dk_option_current'),
      first    = lis.first(),
      last     = lis.last(),
      next,
      prev
    ;

    switch (code) {
      case keyMap.enter:
        if (open) {
         if(!current.hasClass('disabled')){
            _updateFields(current.find('a'), $dk);
                _closeDropdown($dk);
          }
        } else {
          _openDropdown($dk);
        }
        e.preventDefault();
      break;

  case keyMap.tab:
        if(open){
        _updateFields(current.find('a'), $dk);
          _closeDropdown($dk);
        }
      break;

      case keyMap.up:
        prev = current.prev('li');
        if (open) {
          if (prev.length) {
            _setCurrent(prev, $dk);
          } else {
            _setCurrent(last, $dk);
          }
        } else {
          _openDropdown($dk);
        }
        e.preventDefault();
      break;

      case keyMap.down:
        if (open) {
          next = current.next('li').first();
          if (next.length) {
            _setCurrent(next, $dk);
          } else {
            _setCurrent(first, $dk);
          }
        } else {
          _openDropdown($dk);
        }
        e.preventDefault();
      break;

      default:
      break;
    }
    //if typing a letter
    if (code >= keyMap.zero && code <= keyMap.z) {
      //update data
      var now = new Date().getTime();
      if (data.finder == null) {
        data.finder = letter.toUpperCase();
        data.timer = now;

      }else {
        if (now > parseInt(data.timer) + 1000) {
          data.finder = letter.toUpperCase();
          data.timer =  now;
        } else {
          data.finder = data.finder + letter.toUpperCase();
          data.timer = now;
        }
      }
      //find and switch to the appropriate option
      var list = lis.find('a');
      for(var i = 0, len = list.length; i < len; i++){
        var $a = $(list[i]);
        if ($a.html().toUpperCase().indexOf(data.finder) === 0) {
          _updateFields($a, $dk);
          _setCurrent($a.parent(), $dk);
          break;
        }
      }
      $dk.data('dropkick', data);
    }
  }

  // Get the related dropkick element. Useful for reducing repeated code.
  function _getDKElement(scope) {
    var $select   = $(scope),
      list      = $select.data('dropkick');
    return list.$dk;
  }

  // Update the <select> value, and the dropdown label
  function _updateFields(option, $dk, reset) {
    var value, label, data;

    value = option.attr('data-dk-dropdown-value');
    label = option.text();
    data  = $dk.data('dropkick');

    $select = data.$select;
    $select.val(value).trigger('change'); // Added to let it act like a normal select

    $dk.find('.dk_label').text(label);

    reset = reset || false;

    if (data.settings.change && !reset) {
      data.settings.change.call($select, value, label);
    }
  }
  
  // Set the currently selected option
  function _setCurrent($current, $dk) {
    $dk.find('.dk_option_current').removeClass('dk_option_current');
    $current.addClass('dk_option_current');

    _setScrollPos($dk, $current);
  }

  function _setScrollPos($dk, anchor) {
    var height = anchor.prevAll('li').outerHeight() * anchor.prevAll('li').length;
    $dk.find('.dk_options_inner').animate({ scrollTop: height + 'px' }, 0);
  }

  // Close a dropdown
  function _closeDropdown($dk) {
    $dk.removeClass('dk_open');
  }

  // Report whether there is enough space in the window to drop down.
  function _enoughSpace($dk) {
    var
      $dk_toggle = $dk.find('.dk_toggle'),
      optionsHeight = $dk.find('.dk_options').outerHeight(),
      spaceBelow = $(window).height() - $dk_toggle.outerHeight() - $dk_toggle.offset().top + $(window).scrollTop(),
      spaceAbove = $dk_toggle.offset().top - $(window).scrollTop()
    ;
      //[Acemir] If no space above, default is opens down. If has space on top, check if will need open it to up
      return !(optionsHeight < spaceAbove) ? true : (optionsHeight < spaceBelow);
  }

  // Open a dropdown
  function _openDropdown($dk) {
    var data = $dk.data('dropkick'),
        hasSpace = _enoughSpace($dk); // Avoids duplication of call to _enoughSpace
    $dk.find('.dk_options').css({
      top : hasSpace ? $dk.find('.dk_toggle').outerHeight() - 1 : '',
      bottom : hasSpace ? '' : $dk.find('.dk_toggle').outerHeight() - 1
    });
    $dk.toggleClass('dk_open');
  }

  /**
   * Turn the dropdownTemplate into a jQuery object and fill in the variables.
   */
  function _build (tpl, view) {
    var
      // Template for the dropdown
      template  = tpl,
      // Holder of the dropdowns options
      options   = [],
      $dk
    ;

    template = template.replace('{{ id }}', view.id);
    template = template.replace('{{ label }}', view.label);
    template = template.replace('{{ tabindex }}', view.tabindex);

    if (view.options && view.options.length) {
      for (var i = 0, l = view.options.length; i < l; i++) {
        var
          $option   = $(view.options[i]),
          current   = 'dk_option_current',
          disabled  = ' disabled',
          oTemplate = optionTemplate
        ;

        oTemplate = oTemplate.replace('{{ value }}', $option.val());
        oTemplate = oTemplate.replace('{{ current }}', (_notBlank($option.val()) === view.value) ? current : '');
        oTemplate = oTemplate.replace('{{ disabled }}', (typeof $option.attr('disabled') != 'undefined') ? disabled : '');
        oTemplate = oTemplate.replace('{{ text }}', $option.text());

        options[options.length] = oTemplate;
      }
    }

    $dk = $(template);
    $dk.find('.dk_options_inner').html(options.join(''));

    return $dk;
  }

  function _notBlank(text) {
    return ($.trim(text).length > 0) ? text : false;
  }

  $(function () {

    // Handle click events on the dropdown toggler
    $(document).on('click', '.dk_toggle', function (e) {
      var $dk  = $(this).parents('.dk_container').first();

      $dk.hasClass('dk_open') ? _closeDropdown($dk) : _openDropdown($dk); // Avoids duplication of call to _openDropdown

      if ("ontouchstart" in window) {
        $dk.addClass('dk_touch');
        $dk.find('.dk_options_inner').addClass('scrollable vertical');
      }

      e.preventDefault();
      return false;
    });

    // Handle click events on individual dropdown options
    $(document).on((msie ? 'mousedown' : 'click'), '.dk_options a', function (e) {
      var
        $option = $(this),
        $dk     = $option.parents('.dk_container').first(),
        data    = $dk.data('dropkick')
      ;

      if(!$option.parent().hasClass('disabled')){
        _closeDropdown($dk);
          _updateFields($option, $dk);
          _setCurrent($option.parent(), $dk);
      }

      e.preventDefault();
      return false;
    });

    // Setup keyboard nav
    $(document).bind('keydown.dk_nav', function (e) {
      var
        // Look for an open dropdown...
        $open    = $('.dk_container.dk_open'),

        // Look for a focused dropdown
        $focused = $('.dk_container.dk_focus'),

        // Will be either $open, $focused, or null
        $dk = null
      ;

      // If we have an open dropdown, key events should get sent to that one
      if ($open.length) {
        $dk = $open;
      } else if ($focused.length && !$open.length) {
        // But if we have no open dropdowns, use the focused dropdown instead
        $dk = $focused;
      }

      if ($dk) {
        _handleKeyBoardNav(e, $dk);
      }
    });
    
    // Globally handle a click outside of the dropdown list by closing it.
    $(document).on('click', null, function(e) {
        if($(e.target).closest(".dk_container").length == 0) {
            _closeDropdown($('.dk_toggle').parents(".dk_container").first());
        }
    });
  });
})(jQuery, window, document);