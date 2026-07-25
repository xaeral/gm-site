(function () {
  if (window.CharacterService) {
    return;
  }

  function shared() {
    return window.CampaignAtlasCharactersShared || null;
  }

  async function getAll() {
    var api = shared();
    if (!api || !api.readCampaignAtlasState) {
      return [];
    }
    var state = await api.readCampaignAtlasState();
    return state.characters || [];
  }

  async function getById(characterId) {
    if (!characterId) {
      return null;
    }
    var characters = await getAll();
    return characters.find(function (character) { return character.id === characterId; }) || null;
  }

  function save(character) {
    var api = shared();
    if (!api || !api.saveCharacterToCampaignAtlas) {
      return Promise.resolve();
    }
    return api.saveCharacterToCampaignAtlas(character);
  }

  function remove(characterId) {
    var api = shared();
    if (!api || !api.deleteCharacterFromCampaignAtlas) {
      return Promise.resolve();
    }
    return api.deleteCharacterFromCampaignAtlas(characterId);
  }

  function clearAll() {
    var api = shared();
    if (!api || !api.clearAllCharacters) {
      return Promise.resolve();
    }
    return api.clearAllCharacters();
  }

  function clearAllTimelines() {
    var api = shared();
    if (!api || !api.clearAllCharacterTimelines) {
      return Promise.resolve();
    }
    return api.clearAllCharacterTimelines();
  }

  function subscribe(listener) {
    if (typeof listener !== "function" || typeof window.BroadcastChannel !== "function") {
      return function () {};
    }
    var channel = new window.BroadcastChannel("campaign-atlas-characters");
    channel.onmessage = function (event) {
      listener(event && event.data ? event.data : null);
    };
    return function () { channel.close(); };
  }

  // CharacterService is the single source of truth for character records:
  // identity, portraits, biography, clan/sect, generation, convictions,
  // touchstones and every other field that lives on a character. No module
  // should read or write character data through any other path.
  window.CharacterService = {
    getAll: getAll,
    getById: getById,
    save: save,
    delete: remove,
    clearAll: clearAll,
    clearAllTimelines: clearAllTimelines,
    subscribe: subscribe
  };
})();
