// Rubros y tareas predefinidos por sistema
export const DEFAULT_RUBROS_TAREAS = [
    {
        nombre: 'Yesería',
        tareas: [
            {
                nombre: 'Yesería cielorraso',
                descripcion:
                    'Trabajos de yesería realizados en cielorrasos/techo, armado, reparación, terminaciones o cierres.',
                aliases: [
                    'yeso techo',
                    'cielorraso',
                    'yeso cielorraso',
                    'techo yeso',
                ],
                keywords: ['yeso', 'cielorraso', 'techo', 'enduido'],
                ejemplos: [
                    'terminaron el yeso del techo',
                    'cerraron el cielorraso',
                    'faltan detalles en el yeso del living',
                ],
            },
            {
                nombre: 'Yesería paredes',
                descripcion:
                    'Trabajos de yesería sobre paredes, terminaciones, reparación o aplicación de yeso.',
                aliases: ['yeso paredes', 'pared yeso', 'revoque yeso'],
                keywords: ['yeso', 'pared', 'revoque', 'enduido'],
                ejemplos: [
                    'terminaron la yesería de paredes',
                    'faltan detalles de yeso en paredes',
                    'quedó pendiente un sector arriba de la carpintería',
                ],
            },
        ],
    },

    {
        nombre: 'Colocación',
        tareas: [
            {
                nombre: 'Piso balcones',
                descripcion: 'Colocación de piso en balcones.',
                aliases: ['pisos balcón', 'cerámica balcón', 'porcelanato balcón', 'pisos retiro'],
                keywords: ['piso', 'balcón', 'colocación', 'porcelanato'],
                ejemplos: [
                    'terminaron el piso del balcón',
                    'colocaron porcelanato en balcón',
                ],
            },

            {
                nombre: 'Piso baños',
                descripcion: 'Colocación de pisos en baños.',
                aliases: ['piso baño', 'porcelanato baño'],
                keywords: ['piso', 'baño', 'colocación', 'porcelanato'],
                ejemplos: [
                    'terminaron el piso del baño',
                    'colocaron cerámicas en baño',
                    'pusieron porcelanato en el baño'
                ],
            },

            {
                nombre: 'Paredes baños',
                descripcion: 'Revestimientos y colocación de porcelantos/cerámicos en paredes de baño.',
                aliases: ['revestimiento baño', 'cerámicas pared baño', 'porcelanatos en paredes baños'],
                keywords: ['pared', 'baño', 'revestimiento', 'porcelanato', 'cerámicos'],
                ejemplos: [
                    'terminaron las paredes del baño',
                    'colocaron revestimiento en el baño',
                ],
            },
        ],
    },

    {
        nombre: 'Muebles cocina',
        tareas: [
            {
                nombre: 'Alacena',
                descripcion: 'Instalación o colocación de alacenas de cocina.',
                aliases: ['mueble alto', 'alacenas'],
                keywords: ['alacena', 'mueble', 'cocina'],
                ejemplos: [
                    'colocaron las alacenas',
                    'instalaron alacenas de cocina',
                    'dejaron listas las alacenas',
                    'montaron alacenas'
                ],
            },

            {
                nombre: 'Bajo mesada',
                descripcion: 'Instalación de muebles bajo mesada o bajo pileta.',
                aliases: ['mueble bajo mesada', 'bajo cocina', 'mueble bajo pileta'],
                keywords: ['bajo mesada', 'mueble cocina', 'bajo pileta'],
                ejemplos: [
                    'terminaron el bajo mesada',
                    'instalaron muebles inferiores',
                    'colocaron el mueble bajo pileta'
                ],
            },

            {
                nombre: 'Tomas en mueble',
                descripcion:
                    'Huecos o perforaciones en muebles de cocina para instalación de tomas eléctricas.',
                aliases: ['traforos en mueble', 'agujeros tomas'],
                keywords: ['tomas', 'perforaciones', 'traforos'],
                ejemplos: [
                    'hicieron los traforos en la alacena',
                    'dejaron listos los tomas en barra',
                    'hicieron agujeros para tomas en el mueble bajo mesada',
                    'realizaron huecos para tomas de cocina'
                ],
            },
        ],
    },

    {
        nombre: 'Mesadas de baño',
        tareas: [
            {
                nombre: 'Ménsulas',
                descripcion: 'Colocación de ménsulas de soporte para mesadas.',
                aliases: ['soportes', 'mensulas'],
                keywords: ['ménsula', 'soporte'],
                ejemplos: ['colocaron las ménsulas para la mesada del baño'],
            },

            {
                nombre: 'Colocación mesada',
                descripcion: 'Instalación de mesadas de baño.',
                aliases: ['instalación mesada baño'],
                keywords: ['mesada', 'baño'],
                ejemplos: [
                    'colocaron la mesada del baño',
                    'instalaron la mesada de baño',
                    'montaron la mesada del baño'
                ],
            },

            {
                nombre: 'Traforos',
                descripcion:
                    'Perforaciones en mármol o mesada para griferías o bachas.',
                aliases: ['agujeros mesada', 'perforaciones mármol'],
                keywords: ['traforo', 'perforación', 'mármol'],
                ejemplos: ['hicieron los traforos en la mesada del baño'],
            },
        ],
    },

    {
        nombre: 'Mesadas de cocina',
        tareas: [
            {
                nombre: 'Mesada bajo pileta',
                descripcion: 'Instalación de mesada principal bajo pileta.',
                aliases: ['mesada cocina', 'mesada bajo pileta', 'mesada principal'],
                keywords: ['mesada', 'bajo pileta'],
                ejemplos: [
                    'colocaron la mesada',
                    'instalaron la mesada bajo pileta',
                    'montaron la mesada de cocina'
                ],
            },

            {
                nombre: 'Mesada barra',
                descripcion: 'Instalación de barra o mesada tipo barra.',
                aliases: ['barra cocina', 'mesada barra', 'barra desayunadora'],
                keywords: ['barra', 'mesada'],
                ejemplos: [
                    'instalaron la barra',
                    'colocaron la mesada barra',
                    'montaron la barra desayunadora'
                ],
            },

            {
                nombre: 'Traforos en mesada/alzadas',
                descripcion:
                    'Perforaciones para pileta, anafe, tomas o accesorios en mesadas o alzadas.',
                aliases: ['perforaciones', 'agujeros', 'traforos mesada', 'traforos alzadas'],
                keywords: ['traforo', 'agujero'],
                ejemplos: [
                    'hicieron perforaciones en la mesada',
                    'realizaron traforos en alzadas',
                    'hicieron agujeros para tomas',
                    'realizaron perforaciones para anafe en mesada'
                ],
            },

            {
                nombre: 'Alzadas',
                descripcion: 'Colocación de alzadas o revestimiento de cocina.',
                aliases: ['alzadas cocina', 'revestimiento alzada'],
                keywords: ['alzada', 'revestimiento cocina'],
                ejemplos: [
                    'colocaron las alzadas de cocina',
                    'montaron las alzadas',
                    'sellaron las alzadas'
                ],
            },

            {
                nombre: 'Colocación pileta',
                descripcion: 'Instalación de pileta de cocina en mesada de cocina.',
                aliases: ['instalación bacha', 'colocación pileta cocina'],
                keywords: ['pileta', 'bacha'],
                ejemplos: [
                    'colocaron la pileta en la mesada',
                    'instalaron la bacha de cocina',
                    'montaron la pileta de cocina'
                ],
            },

            {
                nombre: 'Colocación anafe',
                descripcion: 'Instalación o montaje de anafe en mesada de cocina.',
                aliases: ['instalaron anafe', 'colocación anafe cocina'],
                keywords: ['anafe'],
                ejemplos: [
                    'montaron el anafe',
                    'colocaron el anafe en la mesada',
                    'instalaron el anafe de cocina'],
            },
        ],
    },

    {
        nombre: 'Instalación sanitaria',
        tareas: [
            {
                nombre: 'Pastina',
                descripcion:
                    'Aplicación de pastina en artefactos sanitarios, rejillas y terminaciones de baño.',
                aliases: [
                    'pastinado',
                    'pastina baño',
                    'sellado rejillas',
                ],
                keywords: ['pastina', 'baño', 'rejilla'],
                ejemplos: [
                    'hicieron la pastina del baño',
                    'pastinaron las rejillas',
                    'pusieron pastina en artefactos sanitarios',
                    'sellaron el inodoro con pastina',
                ],
            },

            {
                nombre: 'Sifón pileta cocina',
                descripcion:
                    'Instalación de sifón para la pileta de cocina.',
                aliases: [
                    'sifón cocina',
                    'desagüe pileta',
                ],
                keywords: ['sifón', 'pileta', 'desagüe'],
                ejemplos: [
                    'colocaron el sifón',
                    'instalaron el desagüe de la pileta',
                ],
            },

            {
                nombre: 'Grifería cocina',
                descripcion:
                    'Instalación de griferías y accesorios de cocina.',
                aliases: [
                    'canilla cocina',
                    'grifería cocina',
                    'monocomando cocina',
                ],
                keywords: ['grifería', 'canilla', 'monocomando'],
                ejemplos: [
                    'instalaron la canilla',
                    'conectaron la grifería de cocina',
                ],
            },

            {
                nombre: 'Flexibles y rosetas',
                descripcion:
                    'Instalación de flexibles y terminaciones sanitarias.',
                aliases: [
                    'flexibles',
                    'rosetas',
                ],
                keywords: ['flexible', 'roseta'],
                ejemplos: [
                    'colocaron flexibles',
                ],
            },

            {
                nombre: 'Descarga bacha baño',
                descripcion:
                    'Instalación de descarga y desagües de bacha de baño.',
                aliases: [
                    'desagüe bacha',
                    'descarga baño',
                ],
                keywords: ['descarga', 'bacha'],
                ejemplos: [
                    'terminaron la descarga de la bacha',
                    'instalaron el desagüe de la bacha de baño',
                ],
            },

            {
                nombre: 'Colocación de artefactos sanitarios',
                descripcion:
                    'Instalación de artefactos sanitarios (inodoro, videt, ducha) y griferías de baño.',
                aliases: [
                    'inodoro',
                    'bidet',
                    'ducha',
                    'griferías baño',
                ],
                keywords: ['sanitarios', 'grifería'],
                ejemplos: [
                    'colocaron el inodoro',
                    'instalaron la ducha',
                    'montaron el bidet',
                ],
            },

            {
                nombre: 'Bañera',
                descripcion:
                    'Instalación y colocación de bañeras.',
                aliases: [
                    'bañera'
                ],
                keywords: ['bañera'],
                ejemplos: [
                    'colocaron la bañera',
                    'instalaron la bañera',
                    'montaron la bañera',
                ],
            },
        ],
    },

    {
        nombre: 'Instalación eléctrica',
        tareas: [
            {
                nombre: 'Teclas y tomas',
                descripcion:
                    'Colocación y conexionado de teclas, llaves de luz, enchufes y tomacorrientes.',
                aliases: [
                    'enchufes',
                    'tomas',
                    'llaves',
                    'teclas',
                    'tomacorrientes',
                ],
                keywords: [
                    'electricidad',
                    'enchufe',
                    'tecla',
                ],
                ejemplos: [
                    'colocaron los enchufes',
                    'instalaron las teclas',
                    'montaron las llaves de luz',
                    'dejaron listos los tomacorrientes',
                    'conectaron las teclas y tomas',
                ],
            },

            {
                nombre: 'Cableado bocas',
                descripcion:
                    'Pasado de cables en bocas eléctricas para iluminación.',
                aliases: [
                    'pasaron cables',
                    'cableado luces',
                ],
                keywords: [
                    'cableado',
                    'bocas',
                    'luces',
                    'iluminación',
                ],
                ejemplos: [
                    'tiraron cables en las bocas',
                    'pasaron el cableado de luces',
                    'conexionaron las bocas de iluminación',
                ],
            },

            {
                nombre: 'Artefactos de iluminación en balcón',
                descripcion:
                    'Instalación de artefactos de iluminación en balcones.',
                aliases: [
                    'luces balcón',
                    'apliques balcón',
                ],
                keywords: [
                    'artefactos',
                    'balcón',
                ],
                ejemplos: [
                    'colocaron las luces del balcón',
                    'instalaron los apliques de balcón',
                ],
            },

            {
                nombre: 'Artefactos de iluminación interiores',
                descripcion:
                    'Instalación de artefactos eléctricos y luminarias en la unidad.',
                aliases: [
                    'luces cocina',
                    'artefactos iluminación cocina',
                    'luminarias interiores',
                    'luces interiores',
                    'artefactos iluminación interiores',
                ],
                keywords: [
                    'artefactos de luz',
                    'luces',
                    'iluminación',
                ],
                ejemplos: [
                    'instalaron las luces de cocina',
                    'colocaron las luminarias interiores',
                    'montaron los artefactos de iluminación interiores',
                ],
            },

            {
                nombre: 'Armado tablero',
                descripcion:
                    'Montaje y conexionado de tablero eléctrico.',
                aliases: [
                    'tablero',
                    'tablero eléctrico',
                ],
                keywords: [
                    'tablero',
                    'térmicas',
                ],
                ejemplos: [
                    'armaron el tablero',
                    'montaron el tablero eléctrico',
                    'conexionaron el tablero',
                    'montaron las térmicas en el tablero',
                ],
            },
        ],
    },

    {
        nombre: 'Pintura',
        tareas: [
            {
                nombre: 'Puerta ingreso hoja',
                descripcion:
                    'Pintura en hoja de puerta de ingreso a la unidad.',
                aliases: [
                    'pintura puerta ingreso',
                ],
                keywords: [
                    'puerta',
                    'pintura',
                    'ingreso',
                ],
                ejemplos: [
                    'pintaron la puerta de ingreso',
                    'terminaron la pintura de la puerta de entrada',
                ],
            },

            {
                nombre: 'Puerta ingreso marco',
                descripcion:
                    'Pintura en marco de puerta de ingreso.',
                aliases: [
                    'marco puerta ingreso',
                ],
                keywords: [
                    'marco',
                    'pintura'
                ],
                ejemplos: [
                    'pintaron el marco de entrada',
                    'terminaron la pintura del marco de la puerta de ingreso',
                ],
            },

            {
                nombre: 'Puerta interior hoja',
                descripcion:
                    'Pintura en hoja/s de puerta/s en el interior de la unidad.',
                aliases: [
                    'puertas interiores',
                    'hojas puertas interiores',
                ],
                keywords: [
                    'puerta interior',
                    'puerta baño',
                    'puerta cocina',
                ],
                ejemplos: [
                    'pintaron las puertas interiores',
                    'terminaron la pintura de las puertas de baño',
                    'pintaron las puertas de cocina',
                ],
            },

            {
                nombre: 'Puerta interior marco',
                descripcion:
                    'Pintura en marco de puerta/s en el interior de la unidad.',
                aliases: [
                    'marcos interiores',
                    'marco puertas interiores',
                ],
                keywords: [
                    'marcos',
                    'marco puerta interior',
                    'marco puerta baño',
                    'marco puerta cocina',
                ],
                ejemplos: [
                    'terminaron marcos interiores',
                    'pintaron los marcos de las puertas de baño',
                    'pintaron los marcos de las puertas de cocina',
                ],
            },

            {
                nombre: 'Paredes',
                descripcion:
                    'Pintura de paredes interiores.',
                aliases: [
                    'pintura paredes',
                    'pintura látex',
                ],
                keywords: [
                    'paredes',
                    'látex',
                    'pintura',
                ],
                ejemplos: [
                    'terminaron de pintar las paredes',
                    'pintaron las paredes del living',
                    'pintaron las paredes de la cocina',
                    'pintaron las paredes del baño',
                ],
            },

            {
                nombre: 'Cielorrasos',
                descripcion:
                    'Pintura de cielorrasos.',
                aliases: [
                    'techos',
                    'pintura techo',
                    'pintura cielorraso',
                ],
                keywords: [
                    'cielorraso',
                    'techo',
                    'pintura',
                ],
                ejemplos: [
                    'pintaron los techos',
                    'pintaron los cielorrasos',
                ],
            },

            {
                nombre: 'Pintura de zócalos',
                descripcion:
                    'Pintura de zócalos.',
                aliases: [
                    'zócalo',
                    'pintura zócalos',
                ],
                keywords: [
                    'zócalos',
                    'pintura',
                ],
                ejemplos: [
                    'pintaron los zócalos',
                    'terminaron de pintar los zócalos',
                ],
            },

            {
                nombre: 'Colocación de zócalos',
                descripcion:
                    'Colocación de zócalos dentro de la unidad.',
                aliases: [
                    'zócalo',
                    'colocación zócalos',
                    'instalación zócalos',
                ],
                keywords: [
                    'zócalos',
                    'colocación',
                ],
                ejemplos: [
                    'colocaron los zócalos',
                    'instalaron los zócalos',
                    'montaron los zócalos',
                ],
            },
        ],
    }
]