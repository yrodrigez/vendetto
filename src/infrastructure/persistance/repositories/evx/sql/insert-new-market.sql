WITH inserted_market AS (
      INSERT INTO evx.prediction_markets (
        reset_id,
        title,
        description,
        status,
        closes_at,
        resolved_outcome_id,
        created_by,
        type,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, 'DRAFT', $4, NULL, $5, $6, NOW(), NOW())
      RETURNING
        reset_id,
        id,
        title,
        description,
        status,
        closes_at,
        resolved_outcome_id,
        created_by,
        created_at,
        updated_at,
        type
    ),
    input_outcomes AS (
      SELECT
        label,
        row_number() OVER ()::int AS sort_order
      FROM unnest($7::text[]) AS label
    ),
    inserted_outcomes AS (
      INSERT INTO evx.prediction_outcomes (
        market_id,
        label,
        sort_order,
        created_at
      )
      SELECT
        inserted_market.id,
        input_outcomes.label,
        input_outcomes.sort_order,
        NOW()
      FROM inserted_market
      CROSS JOIN input_outcomes
      RETURNING
        id,
        market_id,
        label,
        sort_order,
        created_at
    )
    SELECT
      inserted_market.id,
      inserted_market.reset_id,
      inserted_market.title,
      inserted_market.description,
      inserted_market.status,
      inserted_market.closes_at,
      inserted_market.resolved_outcome_id,
      inserted_market.created_by,
      inserted_market.created_at,
      inserted_market.updated_at,
      inserted_market.type,
      COALESCE(
        json_agg(
          json_build_object(
            'id', inserted_outcomes.id,
            'market_id', inserted_outcomes.market_id,
            'label', inserted_outcomes.label,
            'sort_order', inserted_outcomes.sort_order,
            'created_at', inserted_outcomes.created_at
          )
          ORDER BY inserted_outcomes.sort_order
        ) FILTER (WHERE inserted_outcomes.id IS NOT NULL),
        '[]'
      ) AS outcomes
    FROM inserted_market
    LEFT JOIN inserted_outcomes
      ON inserted_outcomes.market_id = inserted_market.id
    GROUP BY
      inserted_market.id,
      inserted_market.reset_id,
      inserted_market.title,
      inserted_market.description,
      inserted_market.status,
      inserted_market.closes_at,
      inserted_market.resolved_outcome_id,
      inserted_market.created_by,
      inserted_market.created_at,
      inserted_market.updated_at,
      inserted_market.type;