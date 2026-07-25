(function () {
  if (window.RelationshipService) {
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
    return state.relationships || [];
  }

  async function getForCharacter(characterId) {
    if (!characterId) {
      return [];
    }
    var relationships = await getAll();
    return relationships.filter(function (relationship) {
      return relationship && (relationship.from === characterId || relationship.to === characterId);
    });
  }

  function saveAll(relationships) {
    var api = shared();
    if (!api || !api.saveRelationships) {
      return Promise.resolve();
    }
    return api.saveRelationships(relationships || []);
  }

  function clearAll() {
    return saveAll([]);
  }

  // RelationshipService owns every relationship record. Relationships exist
  // independently of the Relationship Map and reference characters by ID
  // only -- they must never embed character data.
  window.RelationshipService = {
    getAll: getAll,
    getForCharacter: getForCharacter,
    saveAll: saveAll,
    clearAll: clearAll
  };
})();
